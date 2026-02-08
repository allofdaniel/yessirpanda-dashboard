# Push Notifications Quick Start

Get push notifications up and running in 5 minutes.

## Prerequisites

- Node.js installed
- Supabase project set up
- Dashboard running locally

## 5-Minute Setup

### Step 1: Generate Keys (1 min)

```bash
cd dashboard
node scripts/generate-vapid-keys.js
```

Copy the output to `.env.local`:

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BKx8Abc123...
VAPID_PRIVATE_KEY=Xyz9Def456...
VAPID_EMAIL=mailto:admin@yessirpanda.com
```

### Step 2: Database (1 min)

Run in Supabase SQL Editor:

```sql
-- Copy content from: supabase/migrations/20250208_push_subscriptions.sql
-- Or run: supabase db push
```

### Step 3: Deploy Function (2 min)

```bash
# Set secrets
supabase secrets set VAPID_PUBLIC_KEY=BKx8Abc123...
supabase secrets set VAPID_PRIVATE_KEY=Xyz9Def456...
supabase secrets set VAPID_EMAIL=mailto:admin@yessirpanda.com

# Deploy
supabase functions deploy send-push
```

### Step 4: Test (1 min)

```bash
# Start dev server
npm run dev

# Open http://localhost:3000/settings
# Toggle "푸시 알림 받기" ON
# Grant permission when prompted

# Send test notification
curl -X POST http://localhost:3000/api/push/test \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@example.com"}'
```

## Done! 🎉

You should see a test notification in your browser.

## Next Steps

1. **Integrate with existing functions**:
   - See `PUSH_INTEGRATION_EXAMPLE.md`
   - Add to morning-words, lunch-test, evening-review

2. **Schedule notifications**:
   - Morning: 8:00 AM - Learning reminder
   - Lunch: 12:00 PM - Test reminder
   - Evening: 8:00 PM - Review & streak celebration

3. **Monitor**:
   - Supabase Dashboard > Edge Functions > Logs
   - Database: `SELECT * FROM push_subscriptions;`

## Common Issues

### "VAPID keys not configured"
- Check `.env.local` has all three VAPID variables
- Restart dev server after adding vars

### "Permission denied"
- Click notification icon in browser address bar
- Select "Allow notifications"

### Notification not received
- Check browser console for errors
- Verify subscription exists: `SELECT * FROM push_subscriptions WHERE email = 'your-email';`
- Check service worker: DevTools > Application > Service Workers

## Sending Notifications

### From Edge Function (Production)

```typescript
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
```

### From API Route (Testing)

```bash
curl -X POST http://localhost:3000/api/push/test \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com"}'
```

## Notification Types

- `learning_reminder` - Daily learning prompts
- `streak_celebration` - Achievement celebrations
- `review_reminder` - Review postponed words

## Need Help?

- Setup guide: `PUSH_NOTIFICATIONS_SETUP.md`
- Integration examples: `PUSH_INTEGRATION_EXAMPLE.md`
- Full documentation: `docs/PUSH_NOTIFICATIONS_README.md`
- Checklist: `IMPLEMENTATION_CHECKLIST.md`

## Production Deployment

1. Add VAPID vars to production environment
2. Run migration on production database
3. Set secrets in production Supabase
4. Deploy edge functions to production
5. Test with real user account

That's it! You're ready to send push notifications. 🚀
