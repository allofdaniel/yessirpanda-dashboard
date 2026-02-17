import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase';
import { apiError, parseFailureToResponse, parseJsonRequest, parseEmail, parseOptionalBoolean } from '@/lib/api-contract';
import { requireAuth, verifyEmailOwnership } from '@/lib/auth-middleware';
import { checkRateLimit, responseRateLimited } from '@/lib/request-policy';

type MyMasteredBody = {
  email: string;
  word: string;
  mastered: boolean;
};

export async function POST(request: NextRequest) {
  const rate = checkRateLimit('api:my:mastered', request, {
    maxRequests: 180,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return responseRateLimited(rate.retryAfter || 1, 'api:my:mastered');
  }

  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return apiError('UNAUTHORIZED', 'Authentication required');

  const parsed = await parseJsonRequest<MyMasteredBody>(request, {
    email: { required: true, parse: parseEmail },
    word: {
      required: true,
      parse: (value) => {
        if (typeof value !== 'string') {
          return { success: false, code: 'INVALID_WORD', message: 'word is required' };
        }

        const normalized = value.trim();
        if (!normalized || normalized.length > 200) {
          return { success: false, code: 'INVALID_WORD', message: 'word must be 1..200 chars' };
        }

        return { success: true, value: normalized };
      },
    },
    mastered: { required: true, parse: parseOptionalBoolean },
  });

  if (!parsed.success) {
    return parseFailureToResponse(parsed);
  }

  const { user } = authResult;
  if (!verifyEmailOwnership(user.email, parsed.value.email)) {
    return apiError('FORBIDDEN', 'You can only update your own words');
  }

  const supabase = getServerClient();
  const { error } = await supabase
    .from('wrong_words')
    .update({ mastered: parsed.value.mastered })
    .eq('email', parsed.value.email)
    .eq('word', parsed.value.word);

  if (error) {
    return apiError('DEPENDENCY_ERROR', error.message);
  }

  return NextResponse.json({ success: true });
}
