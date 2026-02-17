import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase';
import { requireAuth, verifyEmailOwnership } from '@/lib/auth-middleware';
import { apiError, parseEmail, parseFailureToResponse, parseJsonRequest } from '@/lib/api-contract';
import webpush from 'web-push';
import { checkRateLimit, responseRateLimited } from '@/lib/request-policy';

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@yessirpanda.com';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
}

interface TestPushBody {
  email: string;
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return apiError('UNAUTHORIZED', 'Authentication required');
    const { user } = authResult;

    const rate = checkRateLimit('api:push:test', request, {
      maxRequests: 10,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return responseRateLimited(rate.retryAfter || 1, 'api:push:test');
    }

    const parsed = await parseJsonRequest<TestPushBody>(request, {
      email: { required: true, parse: parseEmail },
    });
    if (!parsed.success) {
      return parseFailureToResponse(parsed);
    }

    const { email } = parsed.value;

    if (!verifyEmailOwnership(user.email, email)) {
      return apiError('FORBIDDEN', 'Cannot send notification for another user');
    }

    if (!vapidPublicKey || !vapidPrivateKey) {
      return apiError('CONFIG_MISSING', 'VAPID keys not configured');
    }

    const supabase = getServerClient();
    const { data: subscription, error } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('email', email)
      .eq('enabled', true)
      .single();

    if (error || !subscription) {
      return apiError('NOT_FOUND', 'No active push subscription found for this user');
    }

    const payload = JSON.stringify({
      title: 'Push test',
      body: 'Test notification from YessirPanda',
      tag: 'test-notification',
      url: '/',
    });

    await webpush.sendNotification(subscription.subscription, payload);

    return NextResponse.json({ success: true, message: 'Test notification sent' });
  } catch (error: unknown) {
    console.error('Error sending test notification:', error);
    const err = error as { statusCode?: number; message?: string };

    if (err.statusCode === 410) {
      return apiError('DEPENDENCY_ERROR', 'Push subscription has expired. Please re-subscribe.', undefined, 410);
    }

    return apiError('DEPENDENCY_ERROR', err.message || 'Failed to send test notification');
  }
}

