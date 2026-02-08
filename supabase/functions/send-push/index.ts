import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
  requireInteraction?: boolean
}

interface NotificationRequest {
  email?: string
  type?: 'learning_reminder' | 'streak_celebration' | 'review_reminder'
  payload?: PushPayload
  // For batch sending
  emails?: string[]
}

// Helper function to send push notification using web-push protocol
async function sendPushNotification(subscription: any, payload: PushPayload) {
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  const vapidEmail = Deno.env.get('VAPID_EMAIL') || 'mailto:admin@yessirpanda.com'

  if (!vapidPublicKey || !vapidPrivateKey) {
    throw new Error('VAPID keys not configured')
  }

  // Import web-push for Deno
  const webpush = await import('npm:web-push@3.6.7')

  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey)

  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload))
    return { success: true }
  } catch (error: any) {
    console.error('Error sending push notification:', error)
    // If subscription is invalid (410 Gone), mark it for deletion
    if (error.statusCode === 410) {
      return { success: false, invalid: true }
    }
    return { success: false, error: error.message }
  }
}

// Predefined notification templates
function getNotificationPayload(type: string): PushPayload {
  switch (type) {
    case 'learning_reminder':
      return {
        title: '📚 학습 시간이에요!',
        body: '오늘의 비즈니스 영어 단어를 학습할 시간입니다',
        url: '/',
        tag: 'learning-reminder',
        requireInteraction: false,
      }
    case 'streak_celebration':
      return {
        title: '🎉 연속 출석 달성!',
        body: '축하합니다! 연속 출석 기록을 달성했어요',
        url: '/',
        tag: 'streak-celebration',
        requireInteraction: true,
      }
    case 'review_reminder':
      return {
        title: '🔄 복습 시간!',
        body: '미룬 단어를 복습할 시간입니다',
        url: '/',
        tag: 'review-reminder',
        requireInteraction: false,
      }
    default:
      return {
        title: '예스써팬더',
        body: '새로운 알림이 있습니다',
        url: '/',
        tag: 'notification',
      }
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const body: NotificationRequest = await req.json()
    const { email, emails, type, payload } = body

    // Determine which users to send to
    let targetEmails: string[] = []
    if (emails && emails.length > 0) {
      targetEmails = emails
    } else if (email) {
      targetEmails = [email]
    } else {
      // If no specific emails, send to all enabled subscriptions
      const { data: allSubscriptions } = await supabase
        .from('push_subscriptions')
        .select('email')
        .eq('enabled', true)

      if (allSubscriptions) {
        targetEmails = allSubscriptions.map((s: any) => s.email)
      }
    }

    if (targetEmails.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No target emails specified' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Get push subscriptions for target emails
    const { data: subscriptions, error: fetchError } = await supabase
      .from('push_subscriptions')
      .select('email, subscription')
      .in('email', targetEmails)
      .eq('enabled', true)

    if (fetchError) {
      throw fetchError
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No active push subscriptions found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Determine notification payload
    const notificationPayload = payload || (type ? getNotificationPayload(type) : getNotificationPayload('default'))

    // Send push notifications
    const results = await Promise.allSettled(
      subscriptions.map(async (sub: any) => {
        const result = await sendPushNotification(sub.subscription, notificationPayload)

        // If subscription is invalid, delete it
        if (result.invalid) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('email', sub.email)
        }

        return { email: sub.email, ...result }
      })
    )

    const successful = results.filter((r) => r.status === 'fulfilled' && (r.value as any).success).length
    const failed = results.length - successful

    return new Response(
      JSON.stringify({
        success: true,
        sent: successful,
        failed: failed,
        total: results.length,
        results: results.map((r) => r.status === 'fulfilled' ? r.value : { error: 'rejected' }),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Error in send-push function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
