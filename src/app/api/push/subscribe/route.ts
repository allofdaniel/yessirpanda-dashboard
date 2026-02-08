import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, subscription, enabled } = body

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    const supabase = getServerClient()

    // If disabling notifications, delete the subscription
    if (enabled === false) {
      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('email', email)

      if (error) {
        console.error('Error deleting push subscription:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, message: 'Push notifications disabled' })
    }

    // Save or update subscription
    if (!subscription) {
      return NextResponse.json({ error: 'Subscription object required' }, { status: 400 })
    }

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
      )

    if (error) {
      console.error('Error saving push subscription:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Push notifications enabled' })
  } catch (error) {
    console.error('Error in push subscribe API:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get('email')

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    const supabase = getServerClient()
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('enabled, created_at, updated_at')
      .eq('email', email)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No subscription found
        return NextResponse.json({ enabled: false })
      }
      console.error('Error fetching push subscription:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ enabled: data.enabled, created_at: data.created_at, updated_at: data.updated_at })
  } catch (error) {
    console.error('Error in push subscribe GET:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
