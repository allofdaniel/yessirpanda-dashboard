import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase'

// POST: Postpone today's words to tomorrow
export async function POST(request: NextRequest) {
  try {
    const { email, day } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    const supabase = getServerClient()

    // Get current config
    const { data: configData } = await supabase.from('config').select('key, value')
    const config: Record<string, string> = {}
    configData?.forEach((r: { key: string; value: string }) => { config[r.key] = r.value })
    const currentDay = day || parseInt(config.CurrentDay || '1')

    // Get subscriber
    const { data: subscriber } = await supabase
      .from('subscribers')
      .select('id, postponed_days')
      .eq('email', email)
      .single()

    if (!subscriber) {
      return NextResponse.json({ error: 'Subscriber not found' }, { status: 404 })
    }

    // Add current day to postponed_days array
    const postponedDays = subscriber.postponed_days || []
    if (!postponedDays.includes(currentDay)) {
      postponedDays.push(currentDay)
    }

    // Update subscriber
    await supabase
      .from('subscribers')
      .update({
        postponed_days: postponedDays,
        last_postponed_at: new Date().toISOString(),
      })
      .eq('email', email)

    // Also mark today's attendance as postponed (not skipped)
    const today = new Date().toISOString().split('T')[0]
    await supabase.from('attendance').upsert({
      email,
      date: today,
      type: 'postponed',
      completed: false,
      day: currentDay,
    }, { onConflict: 'email,date,type' })

    return NextResponse.json({
      success: true,
      message: `Day ${currentDay} 단어가 내일로 미뤄졌습니다.`,
      postponedDay: currentDay,
    })
  } catch (error) {
    console.error('Postpone error:', error)
    return NextResponse.json({ error: 'Failed to postpone' }, { status: 500 })
  }
}

// GET: Check if user has postponed days to review
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')

  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 })
  }

  const supabase = getServerClient()

  const { data: subscriber } = await supabase
    .from('subscribers')
    .select('postponed_days')
    .eq('email', email)
    .single()

  if (!subscriber) {
    return NextResponse.json({ postponedDays: [] })
  }

  return NextResponse.json({
    postponedDays: subscriber.postponed_days || [],
  })
}

// DELETE: Clear a postponed day after completing it
export async function DELETE(request: NextRequest) {
  try {
    const { email, day } = await request.json()

    if (!email || !day) {
      return NextResponse.json({ error: 'Email and day required' }, { status: 400 })
    }

    const supabase = getServerClient()

    const { data: subscriber } = await supabase
      .from('subscribers')
      .select('postponed_days')
      .eq('email', email)
      .single()

    if (!subscriber) {
      return NextResponse.json({ error: 'Subscriber not found' }, { status: 404 })
    }

    // Remove the day from postponed_days
    const postponedDays = (subscriber.postponed_days || []).filter((d: number) => d !== day)

    await supabase
      .from('subscribers')
      .update({ postponed_days: postponedDays })
      .eq('email', email)

    return NextResponse.json({
      success: true,
      message: `Day ${day} 학습 완료!`,
    })
  } catch (error) {
    console.error('Clear postpone error:', error)
    return NextResponse.json({ error: 'Failed to clear postpone' }, { status: 500 })
  }
}
