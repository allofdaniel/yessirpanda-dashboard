/**
 * Helper function to send push notifications from Supabase Edge Functions
 *
 * Import this in your edge functions to easily send push notifications
 *
 * Usage:
 * import { sendPushNotification } from '../send-push-helper.ts'
 *
 * await sendPushNotification(supabaseUrl, supabaseServiceKey, {
 *   email: 'user@example.com',
 *   type: 'learning_reminder'
 * })
 */

interface SendPushOptions {
  email?: string
  emails?: string[]
  type?: 'learning_reminder' | 'streak_celebration' | 'review_reminder'
  payload?: {
    title: string
    body: string
    url?: string
    tag?: string
    requireInteraction?: boolean
  }
}

interface SendPushResult {
  success: boolean
  sent?: number
  failed?: number
  total?: number
  error?: string
}

export async function sendPushNotification(
  supabaseUrl: string,
  supabaseServiceKey: string,
  options: SendPushOptions
): Promise<SendPushResult> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
    })

    if (!response.ok) {
      const error = await response.json()
      return {
        success: false,
        error: error.error || 'Failed to send push notification',
      }
    }

    const result = await response.json()
    return result
  } catch (error: any) {
    console.error('Error sending push notification:', error)
    return {
      success: false,
      error: error.message || 'Unknown error',
    }
  }
}

/**
 * Send learning reminder notification
 */
export async function sendLearningReminder(
  supabaseUrl: string,
  supabaseServiceKey: string,
  email: string
): Promise<SendPushResult> {
  return sendPushNotification(supabaseUrl, supabaseServiceKey, {
    email,
    type: 'learning_reminder',
  })
}

/**
 * Send streak celebration notification
 */
export async function sendStreakCelebration(
  supabaseUrl: string,
  supabaseServiceKey: string,
  email: string,
  streakCount?: number
): Promise<SendPushResult> {
  if (streakCount) {
    return sendPushNotification(supabaseUrl, supabaseServiceKey, {
      email,
      payload: {
        title: '🎉 연속 출석 달성!',
        body: `축하합니다! ${streakCount}일 연속 출석 기록을 달성했어요`,
        url: '/',
        tag: 'streak-celebration',
        requireInteraction: true,
      },
    })
  }

  return sendPushNotification(supabaseUrl, supabaseServiceKey, {
    email,
    type: 'streak_celebration',
  })
}

/**
 * Send review reminder notification
 */
export async function sendReviewReminder(
  supabaseUrl: string,
  supabaseServiceKey: string,
  email: string,
  postponedCount?: number
): Promise<SendPushResult> {
  if (postponedCount && postponedCount > 0) {
    return sendPushNotification(supabaseUrl, supabaseServiceKey, {
      email,
      payload: {
        title: '🔄 복습 시간!',
        body: `미룬 단어 ${postponedCount}개를 복습할 시간입니다`,
        url: '/',
        tag: 'review-reminder',
        requireInteraction: false,
      },
    })
  }

  return sendPushNotification(supabaseUrl, supabaseServiceKey, {
    email,
    type: 'review_reminder',
  })
}

/**
 * Send batch push notifications to multiple users
 */
export async function sendBatchPushNotifications(
  supabaseUrl: string,
  supabaseServiceKey: string,
  emails: string[],
  type: 'learning_reminder' | 'streak_celebration' | 'review_reminder'
): Promise<SendPushResult> {
  return sendPushNotification(supabaseUrl, supabaseServiceKey, {
    emails,
    type,
  })
}
