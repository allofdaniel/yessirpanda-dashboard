import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';

type PolicyResult = {
  allowed: boolean;
  retryAfter?: number;
};

type RateState = {
  windowStart: number;
  count: number;
};

type ReplayPayload =
  | {
      kind: 'json';
      status: number;
      body: unknown;
      init?: { headers?: Record<string, string> };
    }
  | {
      kind: 'redirect';
      status: number;
      location: string;
    };

type ReplayState = ReplayPayload & {
  expiresAt: number;
};

const rateLimitStore = new Map<string, RateState>();
const replayStore = new Map<string, ReplayState>();
const CLEANUP_INTERVAL_MS = 30_000;
const RATE_LIMIT_STALE_MS = 300_000;
const REPLAY_STALE_MS = 120_000;
let lastCleanup = 0;

const DEFAULT_POLICY = {
  windowMs: 60_000,
  maxRequests: 60,
  replayTtlMs: 20_000,
};

function getClientId(request: Request): string {
  const headers = request.headers;
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    headers.get('cf-connecting-ip') ||
    headers.get('x-vercel-forwarded-for') ||
    headers.get('user-agent') ||
    'anonymous'
  );
}

function getPolicyKey(scope: string, request: Request): string {
  return `${scope}:${getClientId(request)}`;
}

function cleanupStores(now: number): void {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) {
    return;
  }

  rateLimitStore.forEach((state, key) => {
    if (now - state.windowStart > RATE_LIMIT_STALE_MS) {
      rateLimitStore.delete(key);
    }
  });

  replayStore.forEach((state, key) => {
    if (now > state.expiresAt + REPLAY_STALE_MS) {
      replayStore.delete(key);
    }
  });

  lastCleanup = now;
}

export function checkRateLimit(
  scope: string,
  request: Request,
  options: { windowMs?: number; maxRequests?: number } = {},
): PolicyResult {
  const windowMs = options.windowMs ?? DEFAULT_POLICY.windowMs;
  const maxRequests = options.maxRequests ?? DEFAULT_POLICY.maxRequests;
  const now = Date.now();
  const key = getPolicyKey(scope, request);
  cleanupStores(now);

  const state = rateLimitStore.get(key);
  if (!state || now - state.windowStart >= windowMs) {
    rateLimitStore.set(key, { windowStart: now, count: 1 });
    return { allowed: true };
  }

  if (state.count >= maxRequests) {
    const retryAfter = Math.max(1, Math.ceil((state.windowStart + windowMs - now) / 1000));
    return { allowed: false, retryAfter };
  }

  state.count += 1;
  rateLimitStore.set(key, state);
  return { allowed: true };
}

export function responseRateLimited(retryAfter: number, scope?: string): NextResponse {
  const response = NextResponse.json(
    {
      error: {
        code: 'RATE_LIMITED',
        message: 'Request rate limit exceeded',
        ...(scope ? { details: { scope } } : {}),
      },
    },
    { status: 429 }
  );
  response.headers.set('Retry-After', String(retryAfter));
  return response;
}

export function hashPayload(payload: string): string {
  return createHash('sha256').update(payload).digest('hex');
}

export function getReplay(scope: string, key: string): ReplayPayload | null {
  const replayKey = `${scope}:${key}`;
  const saved = replayStore.get(replayKey);

  if (!saved) {
    return null;
  }

  if (Date.now() > saved.expiresAt) {
    replayStore.delete(replayKey);
    return null;
  }

  if (saved.kind === 'json') {
    return {
      kind: 'json',
      status: saved.status,
      body: saved.body,
      init: saved.init,
    };
  }

  return {
    kind: 'redirect',
    status: saved.status,
    location: saved.location,
  };
}

export function setReplay(
  scope: string,
  key: string,
  payload: ReplayPayload,
  ttlMs = DEFAULT_POLICY.replayTtlMs,
): void {
  const replayKey = `${scope}:${key}`;
  replayStore.set(replayKey, {
    ...payload,
    expiresAt: Date.now() + ttlMs,
  });
}

export function replayToResponse(replay: ReplayPayload): NextResponse {
  if (replay.kind === 'redirect') {
    try {
      return NextResponse.redirect(new URL(replay.location), replay.status);
    } catch {
      return NextResponse.redirect('/auth/login', replay.status);
    }
  }

  const init = replay.init;
  return NextResponse.json(replay.body, {
    status: replay.status,
    ...(init?.headers ? { headers: init.headers } : undefined),
  });
}

export function cacheApiResponse(scope: string, key: string, status: number, body: unknown): void {
  cleanupStores(Date.now());
  setReplay(scope, key, {
    kind: 'json',
    status,
    body,
    init: {
      headers: {
        'content-type': 'application/json',
      },
    },
  });
}

export function cacheRedirectResponse(scope: string, key: string, status: number, location: string): void {
  cleanupStores(Date.now());
  setReplay(scope, key, {
    kind: 'redirect',
    status,
    location,
  });
}
