# Web Push Notifications - Complete Implementation

## Overview

A comprehensive web push notification system for YesSirPanda dashboard that sends:
- **학습 리마인더** (Learning reminders at 8am, 12pm, 8pm)
- **연속 출석 축하** (Streak celebrations)
- **미룬 단어 복습** (Review reminders for postponed words)

## Features

✅ Browser-based push notifications (no app required)
✅ Works offline via service worker
✅ Secure VAPID authentication
✅ User-controlled opt-in/opt-out
✅ Customizable notification content
✅ Batch sending support
✅ Cross-browser compatibility

## Project Structure

```
dashboard/
├── public/
│   └── sw.js                                    # Service worker with push handlers
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── push/
│   │   │       ├── subscribe/route.ts           # Subscription management API
│   │   │       └── test/route.ts                # Test notification API
│   │   └── settings/page.tsx                    # Settings UI with notification toggle
│   └── lib/
│       └── push-notifications.ts                # Client-side utilities
├── supabase/
│   ├── functions/
│   │   └── send-push/index.ts                   # Edge function for sending push
│   └── migrations/
│       └── 20250208_push_subscriptions.sql      # Database schema
├── scripts/
│   ├── generate-vapid-keys.js                   # VAPID key generator
│   └── send-push-helper.ts                      # Helper for edge functions
├── PUSH_NOTIFICATIONS_SETUP.md                  # Setup guide
├── PUSH_INTEGRATION_EXAMPLE.md                  # Integration examples
└── .env.local.example                           # Environment template
```

## Quick Start

### 1. Generate VAPID Keys

```bash
node scripts/generate-vapid-keys.js
```

Copy the output to `.env.local`:

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BKx...
VAPID_PRIVATE_KEY=Xyz...
VAPID_EMAIL=mailto:admin@yessirpanda.com
```

### 2. Set up Database

Run the migration:

```bash
# Using Supabase CLI
supabase db push

# Or execute SQL directly in Supabase Dashboard
# File: supabase/migrations/20250208_push_subscriptions.sql
```

### 3. Deploy Edge Function

```bash
# Set secrets
supabase secrets set VAPID_PUBLIC_KEY=BKx...
supabase secrets set VAPID_PRIVATE_KEY=Xyz...
supabase secrets set VAPID_EMAIL=mailto:admin@yessirpanda.com

# Deploy function
supabase functions deploy send-push
```

### 4. Test in Browser

1. Start dev server: `npm run dev`
2. Go to Settings page
3. Toggle "푸시 알림 받기" ON
4. Grant browser permission
5. Test notification:

```bash
curl -X POST http://localhost:3000/api/push/test \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@example.com"}'
```

## Usage Examples

### Frontend: Subscribe User

```typescript
import { subscribeToPushNotifications } from '@/lib/push-notifications'

// Subscribe to push notifications
try {
  await subscribeToPushNotifications('user@example.com')
  console.log('Subscribed successfully!')
} catch (error) {
  console.error('Subscription failed:', error)
}
```

### Backend: Send Notification

#### Option 1: Using Edge Function (Recommended)

```typescript
// Send to single user
await fetch(`${supabaseUrl}/functions/v1/send-push`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${supabaseServiceKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'user@example.com',
    type: 'learning_reminder'
  }),
})

// Send to multiple users
await fetch(`${supabaseUrl}/functions/v1/send-push`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${supabaseServiceKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    emails: ['user1@example.com', 'user2@example.com'],
    type: 'streak_celebration'
  }),
})

// Custom notification
await fetch(`${supabaseUrl}/functions/v1/send-push`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${supabaseServiceKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'user@example.com',
    payload: {
      title: '🎉 Congratulations!',
      body: 'You reached a 30-day streak!',
      url: '/dashboard',
      tag: 'milestone',
      requireInteraction: true
    }
  }),
})
```

#### Option 2: Using Helper Functions

```typescript
import { sendLearningReminder, sendStreakCelebration } from '../scripts/send-push-helper.ts'

// Send learning reminder
await sendLearningReminder(supabaseUrl, supabaseServiceKey, 'user@example.com')

// Send streak celebration with count
await sendStreakCelebration(supabaseUrl, supabaseServiceKey, 'user@example.com', 30)
```

## Notification Types

### 1. Learning Reminder
```typescript
{
  type: 'learning_reminder',
  title: '📚 학습 시간이에요!',
  body: '오늘의 비즈니스 영어 단어를 학습할 시간입니다',
  url: '/',
  requireInteraction: false
}
```

### 2. Streak Celebration
```typescript
{
  type: 'streak_celebration',
  title: '🎉 연속 출석 달성!',
  body: '축하합니다! 연속 출석 기록을 달성했어요',
  url: '/',
  requireInteraction: true
}
```

### 3. Review Reminder
```typescript
{
  type: 'review_reminder',
  title: '🔄 복습 시간!',
  body: '미룬 단어를 복습할 시간입니다',
  url: '/',
  requireInteraction: false
}
```

## Integration with Existing Functions

### Morning Words Function

Add after sending email in `morning-words/index.ts`:

```typescript
// Send push notification
try {
  await fetch(`${supabaseUrl}/functions/v1/send-push`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: sub.email,
      type: 'learning_reminder',
    }),
  })
} catch (pushError) {
  console.error('Failed to send push:', pushError)
}
```

### Evening Review Function

Add streak celebration in `evening-review/index.ts`:

```typescript
if (currentStreak > 0 && [7, 14, 21, 30].includes(currentStreak)) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: subscriber.email,
        payload: {
          title: '🎉 연속 출석 달성!',
          body: `축하합니다! ${currentStreak}일 연속 출석 기록을 달성했어요`,
          url: '/',
          tag: 'streak-celebration',
          requireInteraction: true,
        },
      }),
    })
  } catch (pushError) {
    console.error('Failed to send streak celebration:', pushError)
  }
}
```

See `PUSH_INTEGRATION_EXAMPLE.md` for more examples.

## Database Schema

### push_subscriptions Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| email | TEXT | User email (unique) |
| subscription | JSONB | Browser push subscription object |
| enabled | BOOLEAN | Whether notifications are enabled |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

### Indexes
- `idx_push_subscriptions_email` on `email`
- `idx_push_subscriptions_enabled` on `enabled`

### RLS Policies
- Users can read/insert/update/delete their own subscriptions
- Service role has full access

## API Reference

### POST /api/push/subscribe

Subscribe or unsubscribe from push notifications.

**Request Body:**
```json
{
  "email": "user@example.com",
  "subscription": { /* PushSubscription object */ },
  "enabled": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Push notifications enabled"
}
```

### GET /api/push/subscribe

Get subscription status.

**Query Parameters:**
- `email` (required): User email

**Response:**
```json
{
  "enabled": true,
  "created_at": "2025-02-08T10:00:00Z",
  "updated_at": "2025-02-08T10:00:00Z"
}
```

### POST /api/push/test

Send a test notification.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Test notification sent"
}
```

## Troubleshooting

### Notifications Not Received

1. **Check browser support**:
   ```typescript
   import { isPushNotificationSupported } from '@/lib/push-notifications'
   console.log('Supported:', isPushNotificationSupported())
   ```

2. **Check permission**:
   ```typescript
   console.log('Permission:', Notification.permission)
   ```

3. **Check subscription**:
   ```sql
   SELECT * FROM push_subscriptions WHERE email = 'user@example.com';
   ```

4. **Check service worker**:
   - Open DevTools > Application > Service Workers
   - Verify sw.js is registered and active

5. **Check edge function logs**:
   - Supabase Dashboard > Edge Functions > send-push > Logs

### Permission Denied

- User blocked notifications in browser settings
- Guide user to allow notifications:
  - Chrome: Settings > Privacy and Security > Site Settings > Notifications
  - Firefox: Preferences > Privacy & Security > Permissions > Notifications
  - Safari: Preferences > Websites > Notifications

### 410 Gone Error

Subscription expired. User needs to:
1. Toggle notifications OFF
2. Toggle notifications ON again

### VAPID Errors

- Verify keys match between client and server
- Ensure keys are properly set in environment variables
- Regenerate keys if necessary: `node scripts/generate-vapid-keys.js`

## Security Best Practices

1. **Never commit VAPID keys** to version control
2. **Use HTTPS** in production (required for push notifications)
3. **Validate user input** in API endpoints
4. **Use RLS policies** to protect database
5. **Rate limit** subscription endpoints to prevent abuse
6. **Monitor** for suspicious activity

## Performance Considerations

1. **Batch sending**: Use `emails` array for multiple users
2. **Async processing**: Don't block main email sending
3. **Error handling**: Catch push errors, don't fail main flow
4. **Cleanup**: Remove expired subscriptions (410 errors)
5. **Monitoring**: Track success/failure rates

## Browser Compatibility

| Browser | Version | Support |
|---------|---------|---------|
| Chrome | 50+ | ✅ Full |
| Firefox | 44+ | ✅ Full |
| Safari | 16+ | ✅ Full (macOS 13+) |
| Edge | 17+ | ✅ Full |
| Opera | 37+ | ✅ Full |
| iOS Safari | 16.4+ | ✅ Limited |
| IE | Any | ❌ None |

## Cost Analysis

- **Supabase Edge Functions**: 500K invocations/month (free tier)
- **Database storage**: ~100 bytes per subscription (minimal)
- **Push delivery**: Free (uses browser's push service)
- **Estimated cost**: $0/month for <500K notifications

## Monitoring & Analytics

### Key Metrics to Track

1. **Subscription rate**: Active subscriptions / Total users
2. **Delivery rate**: Successful sends / Total attempts
3. **Click-through rate**: Notification clicks / Total sent
4. **Unsubscribe rate**: Unsubscribes / Total subscriptions

### Query Examples

```sql
-- Active subscriptions
SELECT COUNT(*) FROM push_subscriptions WHERE enabled = true;

-- Subscriptions by date
SELECT DATE(created_at), COUNT(*)
FROM push_subscriptions
GROUP BY DATE(created_at)
ORDER BY DATE(created_at) DESC;

-- Recently updated
SELECT email, updated_at
FROM push_subscriptions
ORDER BY updated_at DESC
LIMIT 10;
```

## Future Enhancements

- [ ] A/B testing for notification content
- [ ] Quiet hours based on user timezone
- [ ] Notification preferences (choose which types to receive)
- [ ] Rich notifications with images/actions
- [ ] Analytics dashboard for notification metrics
- [ ] Scheduled notification queue
- [ ] Notification history for users

## Support

For issues or questions:
1. Check `PUSH_NOTIFICATIONS_SETUP.md` for setup guide
2. Check `PUSH_INTEGRATION_EXAMPLE.md` for code examples
3. Review troubleshooting section above
4. Check browser console for client-side errors
5. Check Supabase logs for server-side errors

## License

Part of the YesSirPanda project.
