# Web Push Notifications Setup Guide

This guide will help you set up web push notifications for the YesSirPanda dashboard.

## Features

- **학습 리마인더**: Scheduled learning reminders (morning 8am, lunch 12pm, evening 8pm)
- **연속 출석 축하**: Streak celebration notifications
- **미룬 단어 복습**: Review reminders for postponed words
- Browser-based push notifications using Web Push API
- Service worker integration for offline support
- VAPID authentication for secure delivery

## Architecture

### Components

1. **Service Worker** (`public/sw.js`)
   - Handles push events
   - Manages notification display
   - Click handler for navigation

2. **Push Subscription API** (`/api/push/subscribe`)
   - Subscribe/unsubscribe endpoint
   - Saves push subscriptions to database

3. **Test Notification API** (`/api/push/test`)
   - Send test notifications
   - Verify push setup

4. **Supabase Edge Function** (`supabase/functions/send-push`)
   - Send push notifications to users
   - Supports batch sending
   - Templates for different notification types

5. **Client Library** (`src/lib/push-notifications.ts`)
   - Helper functions for subscription management
   - Permission handling
   - Browser support detection

6. **Settings UI** (`src/app/settings/page.tsx`)
   - Toggle for enabling/disabling notifications
   - Shows notification types

## Setup Instructions

### Step 1: Generate VAPID Keys

VAPID (Voluntary Application Server Identification) keys are required for web push authentication.

```bash
cd dashboard
node scripts/generate-vapid-keys.js
```

This will output:
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BKx...
VAPID_PRIVATE_KEY=Xyz...
VAPID_EMAIL=mailto:your-email@example.com
```

### Step 2: Configure Environment Variables

Add to `.env.local`:

```env
# Web Push VAPID Keys
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BKx...
VAPID_PRIVATE_KEY=Xyz...
VAPID_EMAIL=mailto:admin@yessirpanda.com
```

### Step 3: Set up Database

Run the migration to create the `push_subscriptions` table:

```bash
# If using Supabase CLI
supabase db push

# Or run the SQL directly in Supabase Dashboard
# File: supabase/migrations/20250208_push_subscriptions.sql
```

The migration creates:
- `push_subscriptions` table
- Indexes for performance
- RLS policies for security
- Auto-update trigger for `updated_at`

### Step 4: Deploy Supabase Edge Function

Configure secrets for the edge function:

```bash
supabase secrets set VAPID_PUBLIC_KEY=BKx...
supabase secrets set VAPID_PRIVATE_KEY=Xyz...
supabase secrets set VAPID_EMAIL=mailto:admin@yessirpanda.com
```

Deploy the function:

```bash
supabase functions deploy send-push
```

### Step 5: Test the Setup

1. **Enable notifications in settings**:
   - Go to Settings page
   - Toggle "푸시 알림 받기" on
   - Grant browser permission when prompted

2. **Send a test notification**:
   ```bash
   # Using curl
   curl -X POST http://localhost:3000/api/push/test \
     -H "Content-Type: application/json" \
     -d '{"email":"user@example.com"}'
   ```

3. **Check browser console** for any errors

## Usage

### Frontend: Subscribe to Notifications

```typescript
import { subscribeToPushNotifications } from '@/lib/push-notifications'

// Subscribe user
await subscribeToPushNotifications('user@example.com')
```

### Backend: Send Notifications

#### Option 1: Using Supabase Edge Function

```bash
# Send to specific user
curl -X POST https://your-project.supabase.co/functions/v1/send-push \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "type": "learning_reminder"
  }'

# Send to multiple users
curl -X POST https://your-project.supabase.co/functions/v1/send-push \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "emails": ["user1@example.com", "user2@example.com"],
    "type": "streak_celebration"
  }'

# Custom notification
curl -X POST https://your-project.supabase.co/functions/v1/send-push \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "payload": {
      "title": "Custom Title",
      "body": "Custom message",
      "url": "/dashboard",
      "tag": "custom-tag"
    }
  }'
```

#### Option 2: Using API Route (for testing)

```typescript
// Send test notification
await fetch('/api/push/test', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'user@example.com' })
})
```

### Notification Types

The edge function supports these pre-defined notification types:

1. **learning_reminder**
   - Title: "📚 학습 시간이에요!"
   - Body: "오늘의 비즈니스 영어 단어를 학습할 시간입니다"
   - Used for: Morning, lunch, evening learning reminders

2. **streak_celebration**
   - Title: "🎉 연속 출석 달성!"
   - Body: "축하합니다! 연속 출석 기록을 달성했어요"
   - Used for: Celebrating attendance streaks
   - Requires interaction: Yes

3. **review_reminder**
   - Title: "🔄 복습 시간!"
   - Body: "미룬 단어를 복습할 시간입니다"
   - Used for: Reminding about postponed words

## Scheduled Notifications

To send scheduled notifications, integrate with your existing Supabase Edge Functions:

### Example: Morning Learning Reminder

Add to `supabase/functions/morning-words/index.ts`:

```typescript
// After sending email, send push notification
const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${supabaseServiceKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: subscriber.email,
    type: 'learning_reminder',
  }),
})
```

### Example: Streak Celebration

Add to `supabase/functions/evening-review/index.ts`:

```typescript
// After calculating streak, send celebration notification
if (currentStreak > 0 && currentStreak % 7 === 0) {
  await fetch(`${supabaseUrl}/functions/v1/send-push`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: subscriber.email,
      type: 'streak_celebration',
    }),
  })
}
```

## Database Schema

```sql
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  subscription JSONB NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

Fields:
- `email`: User's email address (unique)
- `subscription`: Push subscription object from browser
- `enabled`: Whether notifications are enabled
- `created_at`: When subscription was created
- `updated_at`: Last update timestamp

## Troubleshooting

### Notification Permission Denied

If the browser blocks notifications:
1. Check browser notification settings
2. Ensure HTTPS is enabled (required for push notifications)
3. Try in incognito mode to test fresh permissions

### Subscription Errors

If subscription fails:
1. Check VAPID keys are correctly set
2. Verify service worker is registered
3. Check browser console for errors
4. Ensure HTTPS is enabled

### No Notifications Received

1. Check if subscription exists in database
2. Verify edge function is deployed
3. Test with `/api/push/test` endpoint
4. Check service worker is active
5. Verify VAPID keys match between client and server

### 410 Gone Error

This means the push subscription has expired:
1. User should toggle notifications off and on again
2. This will create a new subscription

## Security Notes

1. **VAPID Keys**: Never commit VAPID keys to version control
2. **HTTPS Required**: Push notifications only work on HTTPS
3. **User Permission**: Always require explicit user permission
4. **RLS Policies**: Database has RLS enabled for security
5. **Service Role Key**: Keep `SUPABASE_SERVICE_ROLE_KEY` secret

## Browser Support

Push notifications are supported in:
- Chrome 50+
- Firefox 44+
- Edge 17+
- Safari 16+ (macOS 13+)
- Opera 37+

Not supported in:
- iOS Safari (before iOS 16.4)
- Internet Explorer

## Next Steps

1. Generate VAPID keys: `node scripts/generate-vapid-keys.js`
2. Add environment variables to `.env.local`
3. Run database migration
4. Deploy edge function with secrets
5. Test in browser settings page
6. Integrate with existing scheduled functions
7. Monitor subscription metrics in Supabase dashboard

## Monitoring

Track notification effectiveness:
- Check `push_subscriptions` table for active users
- Monitor edge function logs in Supabase dashboard
- Track notification click-through rates
- Monitor for 410 errors (expired subscriptions)

## Cost Considerations

- Supabase Edge Functions: Free tier includes 500K invocations/month
- Database storage: Minimal (subscription objects are small)
- Push delivery: Free (uses browser's push service)
