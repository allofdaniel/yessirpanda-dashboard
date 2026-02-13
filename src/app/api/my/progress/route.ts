import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase'
import { requireAuth, verifyEmailOwnership, sanitizeEmail } from '@/lib/auth-middleware'

// GET /api/my/progress - Get user's personal progress
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const { user } = authResult

  const emailParam = request.nextUrl.searchParams.get('email')
  const email = sanitizeEmail(emailParam || user.email)

  if (!email) return NextResponse.json({ error: 'Valid email required' }, { status: 400 })

  if (!verifyEmailOwnership(user.email, email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = getServerClient()

  // Get user's progress from subscribers table
  const { data: subscriber, error } = await supabase
    .from('subscribers')
    .select('current_day, started_at, last_lesson_at, status, active_days')
    .eq('email', email)
    .single()

  if (error) {
    // If user doesn't exist in subscribers, create with default values
    if (error.code === 'PGRST116') {
      const { data: newSub, error: insertError } = await supabase
        .from('subscribers')
        .insert({
          email,
          name: '학습자',
          status: 'active',
          current_day: 1,
          started_at: new Date().toISOString(),
        })
        .select('current_day, started_at, last_lesson_at, status, active_days')
        .single()

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }

      return NextResponse.json({
        current_day: newSub?.current_day || 1,
        started_at: newSub?.started_at,
        last_lesson_at: newSub?.last_lesson_at,
        status: newSub?.status || 'active',
        active_days: newSub?.active_days || [1, 2, 3, 4, 5],
      })
    }

    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    current_day: subscriber?.current_day || 1,
    started_at: subscriber?.started_at,
    last_lesson_at: subscriber?.last_lesson_at,
    status: subscriber?.status || 'active',
    active_days: subscriber?.active_days || [1, 2, 3, 4, 5],
  })
}

// POST /api/my/progress - Update user's progress (advance day, etc.)
export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const { user } = authResult

  const body = await request.json()
  const { email, action, day } = body

  const sanitizedEmail = sanitizeEmail(email || user.email)
  if (!sanitizedEmail) return NextResponse.json({ error: 'Valid email required' }, { status: 400 })

  if (!verifyEmailOwnership(user.email, sanitizedEmail)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = getServerClient()

  if (action === 'advance') {
    // Advance to next day
    const { data, error } = await supabase
      .from('subscribers')
      .update({
        current_day: day ? day : undefined,
        last_lesson_at: new Date().toISOString(),
      })
      .eq('email', sanitizedEmail)
      .select('current_day')
      .single()

    if (error) {
      // If no day provided, use RPC to increment
      if (!day) {
        const { data: newDay, error: rpcError } = await supabase.rpc('advance_user_day', {
          user_email: sanitizedEmail
        })

        if (rpcError) {
          return NextResponse.json({ error: rpcError.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, current_day: newDay })
      }

      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, current_day: data?.current_day })
  }

  if (action === 'set') {
    // Set specific day
    const { error } = await supabase
      .from('subscribers')
      .update({ current_day: day })
      .eq('email', sanitizedEmail)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, current_day: day })
  }

  return NextResponse.json({ error: 'Invalid action. Use "advance" or "set"' }, { status: 400 })
}
