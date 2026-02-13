import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase'
import { requireAuth, verifyEmailOwnership, sanitizeEmail } from '@/lib/auth-middleware'

export async function GET(request: NextRequest) {
  // Require authentication
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const { user } = authResult

  const emailParam = request.nextUrl.searchParams.get('email')
  const email = sanitizeEmail(emailParam)

  if (!email) return NextResponse.json({ error: 'Valid email required' }, { status: 400 })

  // Verify user can only access their own settings
  if (!verifyEmailOwnership(user.email, email)) {
    return NextResponse.json({ error: 'Forbidden', message: 'You can only access your own settings' }, { status: 403 })
  }

  const supabase = getServerClient()

  // Fetch settings from subscriber_settings
  const { data, error } = await supabase
    .from('subscriber_settings')
    .select('words_per_day, morning_time, lunch_time, evening_time, timezone, email_enabled, sms_enabled, kakao_enabled, telegram_enabled, telegram_chat_id, google_chat_enabled, google_chat_webhook')
    .eq('email', email)
    .single()

  // Fetch active_days and phone from subscribers table
  const { data: subscriberData } = await supabase
    .from('subscribers')
    .select('active_days, phone')
    .eq('email', email)
    .single()

  const activeDays = subscriberData?.active_days || [1, 2, 3, 4, 5]
  const phone = subscriberData?.phone || ''

  if (error) {
    // If no settings exist, create default
    if (error.code === 'PGRST116') {
      await supabase.from('subscriber_settings').insert({ email, email_enabled: true, sms_enabled: false, kakao_enabled: false, telegram_enabled: false, google_chat_enabled: false })
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
          phone
        }
      })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Ensure nullable string fields are converted to empty strings
  return NextResponse.json({
    settings: {
      ...data,
      telegram_chat_id: data.telegram_chat_id || '',
      google_chat_webhook: data.google_chat_webhook || '',
      active_days: activeDays,
      phone
    }
  })
}

export async function POST(request: NextRequest) {
  // Require authentication
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const { user } = authResult

  const body = await request.json()
  const { email, words_per_day, morning_time, lunch_time, evening_time, timezone, email_enabled, sms_enabled, kakao_enabled, telegram_enabled, telegram_chat_id, google_chat_enabled, google_chat_webhook, active_days, phone } = body

  const sanitizedEmail = sanitizeEmail(email)
  if (!sanitizedEmail) return NextResponse.json({ error: 'Valid email required' }, { status: 400 })

  // Verify user can only update their own settings
  if (!verifyEmailOwnership(user.email, sanitizedEmail)) {
    return NextResponse.json({ error: 'Forbidden', message: 'You can only update your own settings' }, { status: 403 })
  }

  const supabase = getServerClient()
  const { error } = await supabase.from('subscriber_settings').upsert(
    {
      email: sanitizedEmail,
      words_per_day: words_per_day ?? 10,
      morning_time: morning_time || '07:30',
      lunch_time: lunch_time || '13:00',
      evening_time: evening_time || '16:00',
      timezone: timezone || 'Asia/Seoul',
      email_enabled: email_enabled ?? true,
      sms_enabled: sms_enabled ?? false,
      kakao_enabled: kakao_enabled ?? false,
      telegram_enabled: telegram_enabled ?? false,
      telegram_chat_id: telegram_chat_id || null,
      google_chat_enabled: google_chat_enabled ?? false,
      google_chat_webhook: google_chat_webhook || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'email' }
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Also update config WordsPerDay if it changed
  if (words_per_day) {
    await supabase.from('config').upsert(
      { key: 'WordsPerDay', value: String(words_per_day) },
      { onConflict: 'key' }
    )
  }

  // Update active_days and phone in subscribers table
  const subscriberUpdate: { active_days?: number[], phone?: string } = {}
  if (active_days !== undefined) subscriberUpdate.active_days = active_days
  if (phone !== undefined) subscriberUpdate.phone = phone

  if (Object.keys(subscriberUpdate).length > 0) {
    await supabase
      .from('subscribers')
      .update(subscriberUpdate)
      .eq('email', sanitizedEmail)
  }

  return NextResponse.json({ success: true })
}
