import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase';
import { requireAuth, sanitizeEmail, verifyEmailOwnership } from '@/lib/auth-middleware';
import {
  apiError,
  parseFailureToResponse,
  parseJsonObject,
  parseJsonRequest,
  parseOptionalBoolean,
  parseEmail,
} from '@/lib/api-contract';
import { checkRateLimit, responseRateLimited } from '@/lib/request-policy';

interface PushSubscribeBody {
  email: string;
  subscription?: Record<string, unknown>;
  enabled?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return apiError('UNAUTHORIZED', 'Authentication required');
    const { user } = authResult;

    const rate = checkRateLimit('api:push:subscribe', request, {
      maxRequests: 40,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return responseRateLimited(rate.retryAfter || 1, 'api:push:subscribe');
    }

    const parsed = await parseJsonRequest<PushSubscribeBody>(request, {
      email: { required: true, parse: parseEmail },
      enabled: { required: false, parse: parseOptionalBoolean },
      subscription: { required: false, parse: parseJsonObject },
    });

    if (!parsed.success) {
      return parseFailureToResponse(parsed);
    }

    const { email, enabled = false, subscription } = parsed.value;

    if (!verifyEmailOwnership(user.email, email)) {
      return apiError('FORBIDDEN', 'Email does not match authenticated user');
    }

    if (enabled === false) {
      const { error } = await getServerClient()
        .from('push_subscriptions')
        .delete()
        .eq('email', email);

      if (error) {
        console.error('Error deleting push subscription:', error);
        return apiError('DEPENDENCY_ERROR', error.message);
      }

      return NextResponse.json({ success: true, message: 'Push notifications disabled' });
    }

    if (!subscription) {
      return apiError('INVALID_INPUT', 'subscription is required when enabled is true');
    }

    const supabase = getServerClient();

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          email,
          subscription: subscription,
          enabled: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'email' }
      );

    if (error) {
      console.error('Error saving push subscription:', error);
      return apiError('DEPENDENCY_ERROR', error.message);
    }

    return NextResponse.json({ success: true, message: 'Push notifications enabled' });
  } catch (error) {
    console.error('Error in push subscribe API:', error);
    return apiError('DEPENDENCY_ERROR', error instanceof Error ? error.message : 'Unknown error');
  }
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return apiError('UNAUTHORIZED', 'Authentication required');
    const { user } = authResult;

    const rate = checkRateLimit('api:push:subscribe:get', request, {
      maxRequests: 120,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return responseRateLimited(rate.retryAfter || 1, 'api:push:subscribe:get');
    }

    const email = sanitizeEmail(request.nextUrl.searchParams.get('email')) || user.email;
    if (!email || !verifyEmailOwnership(user.email, email)) {
      return apiError('FORBIDDEN', 'You can only view your own push subscription');
    }

    const supabase = getServerClient();
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('enabled, created_at, updated_at')
      .eq('email', email)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ enabled: false });
      }
      console.error('Error fetching push subscription:', error);
      return apiError('DEPENDENCY_ERROR', error.message);
    }

    return NextResponse.json({ enabled: data.enabled, created_at: data.created_at, updated_at: data.updated_at });
  } catch (error) {
    console.error('Error in push subscribe GET:', error);
    return apiError('DEPENDENCY_ERROR', error instanceof Error ? error.message : 'Unknown error');
  }
}

