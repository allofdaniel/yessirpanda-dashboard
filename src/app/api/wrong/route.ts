import { NextRequest, NextResponse } from 'next/server';
import { getWrongWords, updateWrongWord } from '@/lib/db';
import {
  apiError,
  parseFailureToResponse,
  parseIntRange,
  parseJsonRequest,
  parseOptionalText,
  parseEmail,
  parseOptionalBoolean,
  parseJsonObject,
} from '@/lib/api-contract';
import { requireAuth, verifyEmailOwnership } from '@/lib/auth-middleware';
import { checkRateLimit, responseRateLimited } from '@/lib/request-policy';

interface WrongWordData {
  word: string;
  data: {
    Meaning?: string;
    WrongCount?: number;
    LastWrong?: string;
    NextReview?: string;
    Mastered?: boolean;
    mastered?: boolean;
    meaning?: string;
    wrong_count?: number;
    last_wrong?: string;
    next_review?: string;
  };
  email: string;
}

function normalizeWrongWordUpdate(
  data: UnknownWrongWordPayload,
): Record<string, unknown> | null {
  const payload = data as Record<string, unknown>;

  const updates: Record<string, unknown> = {};

  if ('Mastered' in payload) {
    const parsed = parseOptionalBoolean(payload.Mastered);
    if (!parsed.success) return null;
    updates.Mastered = parsed.value;
  }

  if ('mastered' in payload) {
    const parsed = parseOptionalBoolean(payload.mastered);
    if (!parsed.success) return null;
    updates.Mastered = parsed.value;
  }

  if ('Meaning' in payload) {
    const parsed = parseOptionalText(payload.Meaning, { maxLength: 500, allowEmpty: true });
    if (!parsed.success) return null;
    updates.Meaning = parsed.value;
  }

  if ('meaning' in payload) {
    const parsed = parseOptionalText(payload.meaning, { maxLength: 500, allowEmpty: true });
    if (!parsed.success) return null;
    updates.Meaning = parsed.value;
  }

  if ('WrongCount' in payload) {
    const parsed = parseIntRange(payload.WrongCount, { min: 0, max: 9999 });
    if (!parsed.success) return null;
    updates.WrongCount = parsed.value;
  }

  if ('wrong_count' in payload) {
    const parsed = parseIntRange(payload.wrong_count, { min: 0, max: 9999 });
    if (!parsed.success) return null;
    updates.WrongCount = parsed.value;
  }

  if ('LastWrong' in payload) {
    updates.LastWrong = typeof payload.LastWrong === 'string' ? payload.LastWrong : '';
  }

  if ('last_wrong' in payload) {
    updates.LastWrong = typeof payload.last_wrong === 'string' ? payload.last_wrong : '';
  }

  if ('NextReview' in payload) {
    updates.NextReview = typeof payload.NextReview === 'string' ? payload.NextReview : '';
  }

  if ('next_review' in payload) {
    updates.NextReview = typeof payload.next_review === 'string' ? payload.next_review : '';
  }

  if (Object.keys(updates).length === 0) {
    return null;
  }

  return updates;
}

type UnknownWrongWordPayload = Record<string, unknown>;

function parseBooleanQueryParam(
  value: string | null,
): { value: boolean | undefined; error?: string } {
  if (value === null) {
    return { value: undefined };
  }

  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(normalized)) {
    return { value: true };
  }

  if (['false', '0', 'no', 'n'].includes(normalized)) {
    return { value: false };
  }

  return { value: undefined, error: 'Invalid mastered parameter' };
}

export async function GET(request: NextRequest) {
  const rate = checkRateLimit('api:wrong:get', request, {
    maxRequests: 120,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return responseRateLimited(rate.retryAfter || 1, 'api:wrong:get');
  }

  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return apiError('UNAUTHORIZED', 'Authentication required');
    const { user } = authResult;

    const requestedEmail = parseEmail(request.nextUrl.searchParams.get('email')) || user.email;

    const parsedLimit = parseIntRange(Number(request.nextUrl.searchParams.get('limit')), {
      min: 1,
      max: 500,
    });
    if (request.nextUrl.searchParams.has('limit') && !parsedLimit.success) {
      return parseFailureToResponse(parsedLimit);
    }

    const parsedOffset = parseIntRange(Number(request.nextUrl.searchParams.get('offset')), {
      min: 0,
      max: 10000,
    });
    if (request.nextUrl.searchParams.has('offset') && !parsedOffset.success) {
      return parseFailureToResponse(parsedOffset);
    }

    const parsedMastered = parseBooleanQueryParam(request.nextUrl.searchParams.get('mastered'));
    if (parsedMastered.error) {
      return apiError('INVALID_INPUT', parsedMastered.error);
    }

    if (!verifyEmailOwnership(user.email, requestedEmail)) {
      return apiError('FORBIDDEN', 'You can only access your own wrong words');
    }

    const wrongWords = await getWrongWords(requestedEmail, {
      limit: parsedLimit.success ? parsedLimit.value : undefined,
      offset: parsedOffset.success ? parsedOffset.value : undefined,
      mastered: parsedMastered.value,
    });
    return NextResponse.json(wrongWords);
  } catch (error) {
    console.error('Error fetching wrong words:', error);
    return apiError('DEPENDENCY_ERROR', 'Failed to fetch wrong words');
  }
}

export async function POST(request: NextRequest) {
  try {
    const rate = checkRateLimit('api:wrong:post', request, {
      maxRequests: 180,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return responseRateLimited(rate.retryAfter || 1, 'api:wrong:post');
    }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return apiError('UNAUTHORIZED', 'Authentication required');
    const { user } = authResult;

    const parsed = await parseJsonRequest<WrongWordData>(request, {
      email: { required: true, parse: parseEmail },
      word: { required: true, parse: (value) => parseOptionalText(value, { maxLength: 200, allowEmpty: false }) },
      data: { required: true, parse: parseJsonObject },
    });

    if (!parsed.success) {
      return parseFailureToResponse(parsed);
    }

    const { email, word, data } = parsed.value;

    if (!verifyEmailOwnership(user.email, email)) {
      return apiError('FORBIDDEN', 'You can only update your own data');
    }

    const patch = normalizeWrongWordUpdate(data as UnknownWrongWordPayload);
    if (!patch) {
      return apiError('INVALID_INPUT', 'Invalid wrong word update payload');
    }

    await updateWrongWord(email, word, patch);
    return NextResponse.json({ success: true, email, word });
  } catch (error) {
    console.error('Error updating wrong word:', error);
    return apiError('DEPENDENCY_ERROR', error instanceof Error ? error.message : 'Failed to update wrong word');
  }
}

