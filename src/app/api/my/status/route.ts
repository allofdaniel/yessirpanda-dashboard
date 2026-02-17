import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase';
import {
  apiError,
  parseFailureToResponse,
  parseJsonRequest,
  parseEmail,
  parseStatus,
} from '@/lib/api-contract';
import { requireAuth, verifyEmailOwnership } from '@/lib/auth-middleware';
import { checkRateLimit, responseRateLimited } from '@/lib/request-policy';

type StatusUpdateBody = {
  email?: string;
  status: 'active' | 'paused';
};

export async function POST(request: NextRequest) {
  const rate = checkRateLimit('api:my:status', request, {
    maxRequests: 120,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return responseRateLimited(rate.retryAfter || 1, 'api:my:status');
  }

  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return apiError('UNAUTHORIZED', 'Authentication required');
  const { user } = authResult;

  const parsed = await parseJsonRequest<StatusUpdateBody>(request, {
    email: {
      required: false,
      parse: parseEmail,
    },
    status: { required: true, parse: parseStatus },
  });

  if (!parsed.success) {
    return parseFailureToResponse(parsed);
  }

  const payload = parsed.value;
  const email = payload.email || user.email;

  if (!verifyEmailOwnership(user.email, email)) {
    return apiError('FORBIDDEN', 'Forbidden', 'Not allowed to change this user status');
  }

  const supabase = getServerClient();
  const { error } = await supabase
    .from('subscribers')
    .update({ status: payload.status })
    .eq('email', email);

  if (error) {
    return apiError('DEPENDENCY_ERROR', error.message);
  }

  return NextResponse.json({ success: true, status: payload.status });
}

