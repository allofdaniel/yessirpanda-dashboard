import { NextRequest, NextResponse } from 'next/server';
import { getResults } from '@/lib/db';
import { requireAuth, sanitizeDay, sanitizeEmail, verifyEmailOwnership } from '@/lib/auth-middleware';
import { apiError, parseFailureToResponse, parseIntRange } from '@/lib/api-contract';
import { checkRateLimit, responseRateLimited } from '@/lib/request-policy';

// GET /api/results?email=X&day=N - Get results (optionally filtered by email and day)
export async function GET(request: NextRequest) {
  const rate = checkRateLimit('api:results:get', request, {
    maxRequests: 120,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return responseRateLimited(rate.retryAfter || 1, 'api:results:get');
  }

  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return apiError('UNAUTHORIZED', 'Authentication required');
    const { user } = authResult;

    const searchParams = request.nextUrl.searchParams;
    const requestedEmail = sanitizeEmail(searchParams.get('email'));
    const dayParam = searchParams.get('day');
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');

    const email = requestedEmail || user.email;
    if (!verifyEmailOwnership(user.email, email)) {
      return apiError('FORBIDDEN', 'You can only access your own results');
    }

    let limit: number | undefined;
    let offset: number | undefined;

    if (limitParam !== null) {
      const parsedLimit = parseIntRange(Number(limitParam), { min: 1, max: 500 });
      if (!parsedLimit.success) {
        return parseFailureToResponse(parsedLimit);
      }
      limit = parsedLimit.value;
    }

    if (offsetParam !== null) {
      const parsedOffset = parseIntRange(Number(offsetParam), { min: 0, max: 10000 });
      if (!parsedOffset.success) {
        return parseFailureToResponse(parsedOffset);
      }
      offset = parsedOffset.value;
    }

    let day: number | undefined;
    if (dayParam) {
      const parsed = sanitizeDay(dayParam);
      if (!parsed) {
        return apiError('INVALID_INPUT', 'Invalid day parameter');
      }
      day = parsed;
    }

    const results = await getResults(email, day, { limit, offset });
    return NextResponse.json(results);
  } catch (error) {
    console.error('Error fetching results:', error);
    return apiError(
      'DEPENDENCY_ERROR',
      'Failed to fetch results',
      process.env.NODE_ENV === 'development'
        ? { details: error instanceof Error ? error.message : String(error) }
        : undefined,
    );
  }
}
