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
  const { data, error } = await supabase
    .from('subscriber_settings')
    .select('words_per_day, morning_time, lunch_time, evening_time, timezone, email_enabled, kakao_enabled')
    .eq('email', email)
    .single()

  if (error) {
    // If no settings exist, create default
    if (error.code === 'PGRST116') {
      await supabase.from('subscriber_settings').insert({ email, email_enabled: true, kakao_enabled: true })
      return NextResponse.json({
        settings: { words_per_day: 10, morning_time: '07:30', lunch_time: '13:00', evening_time: '16:00', timezone: 'Asia/Seoul', email_enabled: true, kakao_enabled: true }
      })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ settings: data })
}

export async function POST(request: NextRequest) {
  // Require authentication
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const { user } = authResult

  const body = await request.json()
  const { email, words_per_day, morning_time, lunch_time, evening_time, timezone, email_enabled, kakao_enabled, active_days } = body

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
      kakao_enabled: kakao_enabled ?? true,
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

  // Update active_days in subscribers table
  if (active_days !== undefined) {
    await supabase
      .from('subscribers')
      .update({ active_days })
      .eq('email', sanitizedEmail)
  }

  return NextResponse.json({ success: true })
}
