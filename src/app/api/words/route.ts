import { NextRequest, NextResponse } from 'next/server';
import { getWords, getAllWords } from '@/lib/db';
import { sanitizeDay } from '@/lib/auth-middleware';
import { apiError } from '@/lib/api-contract';
import { checkRateLimit, responseRateLimited } from '@/lib/request-policy';

// GET /api/words?day=N - Get words (optionally filtered by day)
export async function GET(request: NextRequest) {
  try {
    const rate = checkRateLimit('api:words:get', request, {
      maxRequests: 120,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return responseRateLimited(rate.retryAfter || 1, 'api:words:get');
    }

    const searchParams = request.nextUrl.searchParams;
    const dayParam = searchParams.get('day');

    let words;
    if (dayParam) {
      const day = sanitizeDay(dayParam);
      if (!day) {
        return apiError('INVALID_INPUT', 'Invalid day parameter');
      }
      words = await getWords(day);
    } else {
      words = await getAllWords();
    }

    return NextResponse.json(words);
  } catch (error) {
    console.error('Error fetching words:', error);
    return apiError(
      'DEPENDENCY_ERROR',
      'Failed to fetch words',
      process.env.NODE_ENV === 'development'
        ? { details: error instanceof Error ? error.message : String(error) }
        : undefined,
    );
  }
}
