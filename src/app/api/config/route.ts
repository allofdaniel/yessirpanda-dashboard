import { NextRequest, NextResponse } from 'next/server';
import { getConfig, updateConfig } from '@/lib/db';
import { requireAuth, requireAdmin } from '@/lib/auth-middleware';
import {
  apiError,
  parseConfigKey,
  parseFailureToResponse,
  parseJsonRequest,
  parseText,
} from '@/lib/api-contract';
import { checkRateLimit, responseRateLimited } from '@/lib/request-policy';

interface ConfigUpdateBody {
  key: string;
  value: string;
}

// GET /api/config - Get configuration
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return apiError('UNAUTHORIZED', 'Authentication required');

    const config = await getConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error('Error fetching config:', error);
    return apiError(
      'DEPENDENCY_ERROR',
      'Failed to fetch config',
      process.env.NODE_ENV === 'development'
        ? { details: error instanceof Error ? error.message : String(error) }
        : undefined,
    );
  }
}

// POST /api/config - Update configuration
export async function POST(request: NextRequest) {
  const rate = checkRateLimit('api:config', request, {
    maxRequests: 30,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return responseRateLimited(rate.retryAfter || 1, 'api:config');
  }

  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return apiError('UNAUTHORIZED', 'Authentication required');
    const { user } = authResult;

    if (!requireAdmin(user.email)) {
      return apiError('FORBIDDEN', 'Admin access required');
    }

    const parsed = await parseJsonRequest<ConfigUpdateBody>(request, {
      key: { required: true, parse: parseConfigKey },
      value: { required: true, parse: (value) => parseText(value, { maxLength: 500 }) },
    });
    if (!parsed.success) {
      return parseFailureToResponse(parsed);
    }

    const { key, value } = parsed.value;

    await updateConfig(key, value);
    return NextResponse.json({ success: true, key, value });
  } catch (error) {
    console.error('Error updating config:', error);
    return apiError(
      'DEPENDENCY_ERROR',
      'Failed to update config',
      process.env.NODE_ENV === 'development'
        ? { details: error instanceof Error ? error.message : String(error) }
        : undefined,
    );
  }
}

