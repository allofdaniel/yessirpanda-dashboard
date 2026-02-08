import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase'
import webpush from 'web-push'

// Configure web-push with VAPID keys
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || ''
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@yessirpanda.com'

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    if (!vapidPublicKey || !vapidPrivateKey) {
      return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 })
    }

    // Get push subscription from database
    const supabase = getServerClient()
    const { data: subscription, error } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('email', email)
      .eq('enabled', true)
      .single()

    if (error || !subscription) {
      return NextResponse.json(
        { error: 'No active push subscription found for this user' },
        { status: 404 }
      )
    }

    // Send test notification
    const payload = JSON.stringify({
      title: '🎉 테스트 알림',
      body: '푸시 알림이 정상적으로 작동합니다!',
      tag: 'test-notification',
      url: '/',
    })

    await webpush.sendNotification(subscription.subscription, payload)

    return NextResponse.json({ success: true, message: 'Test notification sent' })
  } catch (error: any) {
    console.error('Error sending test notification:', error)

    // Handle subscription expiration
    if (error.statusCode === 410) {
      return NextResponse.json(
        { error: 'Push subscription has expired. Please re-subscribe.' },
        { status: 410 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Failed to send test notification' },
      { status: 500 }
    )
  }
}
