/**
 * Push Notifications Utility
 *
 * Handles web push notification subscription and management
 * Uses the Web Push API with VAPID authentication
 */

// VAPID public key - this should match your server's VAPID public key
// Generate keys using: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

/**
 * Convert VAPID public key from base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/**
 * Check if push notifications are supported
 */
export function isPushNotificationSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window
}

/**
 * Request notification permission from user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isPushNotificationSupported()) {
    throw new Error('Push notifications are not supported')
  }

  const permission = await Notification.requestPermission()
  return permission
}

/**
 * Get current notification permission status
 */
export function getNotificationPermission(): NotificationPermission {
  if (!isPushNotificationSupported()) {
    return 'denied'
  }
  return Notification.permission
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPushNotifications(email: string): Promise<boolean> {
  try {
    if (!isPushNotificationSupported()) {
      throw new Error('Push notifications are not supported')
    }

    // Check permission
    let permission = Notification.permission
    if (permission === 'default') {
      permission = await Notification.requestPermission()
    }

    if (permission !== 'granted') {
      throw new Error('Notification permission denied')
    }

    // Register service worker if not already registered
    let registration = await navigator.serviceWorker.getRegistration()
    if (!registration) {
      registration = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
    }

    if (!VAPID_PUBLIC_KEY) {
      throw new Error('VAPID public key not configured')
    }

    // Subscribe to push notifications
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    })

    // Send subscription to server
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        subscription: subscription.toJSON(),
        enabled: true,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to save subscription')
    }

    return true
  } catch (error) {
    console.error('Error subscribing to push notifications:', error)
    throw error
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPushNotifications(email: string): Promise<boolean> {
  try {
    if (!isPushNotificationSupported()) {
      return true
    }

    // Get service worker registration
    const registration = await navigator.serviceWorker.getRegistration()
    if (!registration) {
      return true
    }

    // Get existing subscription
    const subscription = await registration.pushManager.getSubscription()
    if (subscription) {
      await subscription.unsubscribe()
    }

    // Remove subscription from server
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        enabled: false,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to remove subscription')
    }

    return true
  } catch (error) {
    console.error('Error unsubscribing from push notifications:', error)
    throw error
  }
}

/**
 * Check if user is currently subscribed
 */
export async function isSubscribed(): Promise<boolean> {
  try {
    if (!isPushNotificationSupported()) {
      return false
    }

    const registration = await navigator.serviceWorker.getRegistration()
    if (!registration) {
      return false
    }

    const subscription = await registration.pushManager.getSubscription()
    return subscription !== null
  } catch (error) {
    console.error('Error checking subscription status:', error)
    return false
  }
}

/**
 * Get subscription status from server
 */
export async function getSubscriptionStatus(email: string): Promise<{ enabled: boolean; created_at?: string; updated_at?: string }> {
  try {
    const response = await fetch(`/api/push/subscribe?email=${encodeURIComponent(email)}`)
    if (!response.ok) {
      return { enabled: false }
    }
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching subscription status:', error)
    return { enabled: false }
  }
}

/**
 * Test push notification (sends a test notification)
 */
export async function sendTestNotification(email: string): Promise<boolean> {
  try {
    const response = await fetch('/api/push/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to send test notification')
    }

    return true
  } catch (error) {
    console.error('Error sending test notification:', error)
    throw error
  }
}
