import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase';
import { apiError } from '@/lib/api-contract';
import { checkRateLimit, responseRateLimited } from '@/lib/request-policy';

// GET /api/invite/[code] - Get inviter info by invite code
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const rate = checkRateLimit('api:invite:code', request, {
    maxRequests: 120,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return responseRateLimited(rate.retryAfter || 1, 'api:invite:code');
  }

  const { code } = await params;

  if (!code || code.length < 4) {
    return apiError('INVALID_INPUT', 'Invalid invite code');
  }

  const supabase = getServerClient();
  const normalizedCode = code.toUpperCase();

  const { data: subscriber, error } = await supabase
    .from('subscribers')
    .select('name, email')
    .eq('invite_code', normalizedCode)
    .single();

  if (error || !subscriber) {
    if (error?.code !== 'PGRST116') {
      console.error('Invite lookup error:', error?.message);
    }
    return apiError('NOT_FOUND', 'Invite code not found');
  }

  return NextResponse.json({
    inviter: {
      name: subscriber.name || 'Anonymous',
    },
    code: normalizedCode,
  });
}

