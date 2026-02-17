import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase';
import { requireAuth, verifyEmailOwnership, sanitizeEmail } from '@/lib/auth-middleware';
import {
  apiError,
  parseFailureToResponse,
  parseJsonRequest,
  parseActiveDays,
  parseEmail,
  parseHHmm,
  parseOptionalBoolean,
  parseOptionalText,
  parsePhone,
  parseTimezone,
  parseIntRange,
} from '@/lib/api-contract';
import { checkRateLimit, responseRateLimited } from '@/lib/request-policy';

interface SettingsUpdateRequest {
  email: string;
  words_per_day?: number;
  morning_time?: string;
  lunch_time?: string;
  evening_time?: string;
  timezone?: string;
  email_enabled?: boolean;
  sms_enabled?: boolean;
  kakao_enabled?: boolean;
  telegram_enabled?: boolean;
  telegram_chat_id?: string;
  google_chat_enabled?: boolean;
  google_chat_webhook?: string;
  active_days?: number[];
  phone?: string;
}

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return apiError('UNAUTHORIZED', 'Authentication required');
  const { user } = authResult;

  const emailParam = request.nextUrl.searchParams.get('email');
  const email = sanitizeEmail(emailParam);

  if (!email) {
    return apiError('INVALID_INPUT', 'Valid email is required');
  }

  if (!verifyEmailOwnership(user.email, email)) {
    return apiError('FORBIDDEN', 'You can only access your own settings');
  }

  const supabase = getServerClient();

  const { data, error } = await supabase
    .from('subscriber_settings')
    .select(
      'words_per_day, morning_time, lunch_time, evening_time, timezone, email_enabled, sms_enabled, kakao_enabled, telegram_enabled, telegram_chat_id, google_chat_enabled, google_chat_webhook'
    )
    .eq('email', email)
    .single();

  const { data: subscriberData } = await supabase
    .from('subscribers')
    .select('active_days, phone')
    .eq('email', email)
    .single();

  const activeDaysResult = parseActiveDays(subscriberData?.active_days || [1, 2, 3, 4, 5]);
  const activeDays = activeDaysResult.success ? activeDaysResult.value : [1, 2, 3, 4, 5];
  const phone = typeof subscriberData?.phone === 'string' ? subscriberData.phone : '';

  if (error) {
    if (error.code === 'PGRST116') {
      await supabase.from('subscriber_settings').insert({
        email,
        email_enabled: true,
        sms_enabled: false,
        kakao_enabled: false,
        telegram_enabled: false,
        google_chat_enabled: false,
      });

      return NextResponse.json({
        settings: {
          words_per_day: 10,
          morning_time: '07:30',
          lunch_time: '13:00',
          evening_time: '16:00',
          timezone: 'Asia/Seoul',
          email_enabled: true,
          sms_enabled: false,
          kakao_enabled: false,
          telegram_enabled: false,
          telegram_chat_id: '',
          google_chat_enabled: false,
          google_chat_webhook: '',
          active_days: activeDays,
          phone,
        },
      });
    }

    return apiError('DEPENDENCY_ERROR', 'Failed to load settings', error.message);
  }

  return NextResponse.json({
    settings: {
      ...data,
      telegram_chat_id: data.telegram_chat_id || '',
      google_chat_webhook: data.google_chat_webhook || '',
      active_days: activeDays,
      phone,
    },
  });
}

export async function POST(request: NextRequest) {
  const rate = checkRateLimit('api:my:settings', request, {
    maxRequests: 60,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return responseRateLimited(rate.retryAfter || 1, 'api:my:settings');
  }

  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return apiError('UNAUTHORIZED', 'Authentication required');
  const { user } = authResult;

  const parsed = await parseJsonRequest<SettingsUpdateRequest>(request, {
    email: { required: true, parse: parseEmail },
    words_per_day: {
      required: false,
      parse: (value) => parseIntRange(value, { min: 1, max: 500 }),
    },
    morning_time: { required: false, parse: parseHHmm },
    lunch_time: { required: false, parse: parseHHmm },
    evening_time: { required: false, parse: parseHHmm },
    timezone: { required: false, parse: parseTimezone },
    email_enabled: { required: false, parse: parseOptionalBoolean },
    sms_enabled: { required: false, parse: parseOptionalBoolean },
    kakao_enabled: { required: false, parse: parseOptionalBoolean },
    telegram_enabled: { required: false, parse: parseOptionalBoolean },
    telegram_chat_id: {
      required: false,
      parse: (value) => parseOptionalText(value, { maxLength: 128, allowEmpty: true }),
    },
    google_chat_enabled: { required: false, parse: parseOptionalBoolean },
    google_chat_webhook: {
      required: false,
      parse: (value) => parseOptionalText(value, { maxLength: 500, allowEmpty: true }),
    },
    active_days: { required: false, parse: parseActiveDays },
    phone: { required: false, parse: parsePhone },
  });

  if (!parsed.success) {
    return parseFailureToResponse(parsed);
  }

  const payload = parsed.value;

  if (!verifyEmailOwnership(user.email, payload.email)) {
    return apiError('FORBIDDEN', 'You can only update your own settings');
  }

  const updatePayload: Record<string, unknown> = {};
  const subscriberUpdate: { active_days?: number[]; phone?: string } = {};

  if (payload.words_per_day !== undefined) updatePayload.words_per_day = payload.words_per_day;
  if (payload.morning_time !== undefined) updatePayload.morning_time = payload.morning_time;
  if (payload.lunch_time !== undefined) updatePayload.lunch_time = payload.lunch_time;
  if (payload.evening_time !== undefined) updatePayload.evening_time = payload.evening_time;
  if (payload.timezone !== undefined) updatePayload.timezone = payload.timezone;
  if (payload.email_enabled !== undefined) updatePayload.email_enabled = payload.email_enabled;
  if (payload.sms_enabled !== undefined) updatePayload.sms_enabled = payload.sms_enabled;
  if (payload.kakao_enabled !== undefined) updatePayload.kakao_enabled = payload.kakao_enabled;
  if (payload.telegram_enabled !== undefined) updatePayload.telegram_enabled = payload.telegram_enabled;
  if (payload.telegram_chat_id !== undefined) updatePayload.telegram_chat_id = payload.telegram_chat_id || null;
  if (payload.google_chat_enabled !== undefined) updatePayload.google_chat_enabled = payload.google_chat_enabled;
  if (payload.google_chat_webhook !== undefined) updatePayload.google_chat_webhook = payload.google_chat_webhook || null;
  if (payload.active_days !== undefined) subscriberUpdate.active_days = payload.active_days;
  if (payload.phone !== undefined) subscriberUpdate.phone = payload.phone;

  if (Object.keys(updatePayload).length === 0 && Object.keys(subscriberUpdate).length === 0) {
    return apiError('INVALID_INPUT', 'No updatable fields provided');
  }

  const supabase = getServerClient();

  if (Object.keys(updatePayload).length > 0) {
    const { error } = await supabase.from('subscriber_settings').upsert(
      {
        email: payload.email,
        ...updatePayload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'email' }
    );

    if (error) {
      return apiError('DEPENDENCY_ERROR', error.message);
    }
  }

  if (payload.words_per_day !== undefined) {
    const configUpdate = await supabase.from('config').upsert(
      { key: 'WordsPerDay', value: String(payload.words_per_day) },
      { onConflict: 'key' }
    );

    if (configUpdate.error) {
      console.error('[My Settings API] Failed to sync WordsPerDay config:', configUpdate.error);
    }
  }

  if (Object.keys(subscriberUpdate).length > 0) {
    const { error: subscriberError } = await supabase
      .from('subscribers')
      .update(subscriberUpdate)
      .eq('email', payload.email);

    if (subscriberError) {
      return apiError('DEPENDENCY_ERROR', subscriberError.message);
    }
  }

  return NextResponse.json({ success: true });
}

