# Push Notifications Implementation Checklist

Use this checklist to ensure proper setup of web push notifications.

## Pre-Implementation

- [ ] Read `PUSH_NOTIFICATIONS_SETUP.md`
- [ ] Review `PUSH_INTEGRATION_EXAMPLE.md`
- [ ] Understand browser compatibility requirements
- [ ] Plan notification schedule (morning, lunch, evening)

## Setup Phase

### 1. Generate VAPID Keys
- [ ] Run `node scripts/generate-vapid-keys.js`
- [ ] Copy output to `.env.local`
- [ ] Keep keys secure (don't commit to git)
- [ ] Verify `.env.local.example` is committed instead

### 2. Environment Configuration
- [ ] Add `NEXT_PUBLIC_VAPID_PUBLIC_KEY` to `.env.local`
- [ ] Add `VAPID_PRIVATE_KEY` to `.env.local`
- [ ] Add `VAPID_EMAIL` to `.env.local`
- [ ] Verify existing Supabase vars are set

### 3. Database Setup
- [ ] Review migration file: `supabase/migrations/20250208_push_subscriptions.sql`
- [ ] Run migration: `supabase db push` OR execute in Supabase Dashboard
- [ ] Verify `push_subscriptions` table exists
- [ ] Check indexes are created
- [ ] Verify RLS policies are active

### 4. Edge Function Deployment
- [ ] Set Supabase secrets:
  - [ ] `supabase secrets set VAPID_PUBLIC_KEY=...`
  - [ ] `supabase secrets set VAPID_PRIVATE_KEY=...`
  - [ ] `supabase secrets set VAPID_EMAIL=...`
- [ ] Deploy function: `supabase functions deploy send-push`
- [ ] Verify function appears in Supabase Dashboard
- [ ] Test function with curl or Postman

## Testing Phase

### 5. Local Testing
- [ ] Start dev server: `npm run dev`
- [ ] Open browser DevTools
- [ ] Navigate to Settings page
- [ ] Toggle "푸시 알림 받기" ON
- [ ] Grant browser permission when prompted
- [ ] Check browser console for errors
- [ ] Verify subscription in `push_subscriptions` table
- [ ] Send test notification:
  ```bash
  curl -X POST http://localhost:3000/api/push/test \
    -H "Content-Type: application/json" \
    -d '{"email":"your-test-email@example.com"}'
  ```
- [ ] Verify notification appears
- [ ] Click notification and verify navigation

### 6. Service Worker Verification
- [ ] Open DevTools > Application > Service Workers
- [ ] Verify `sw.js` is registered
- [ ] Check service worker status is "activated"
- [ ] Check for service worker errors
- [ ] Test offline behavior (disconnect network)

### 7. Cross-Browser Testing
- [ ] Test on Chrome
- [ ] Test on Firefox
- [ ] Test on Safari (macOS 13+)
- [ ] Test on Edge
- [ ] Test on mobile browsers (if applicable)
- [ ] Document any browser-specific issues

## Integration Phase

### 8. Integrate with Existing Functions

#### Morning Words Function
- [ ] Open `supabase/functions/morning-words/index.ts`
- [ ] Add push notification call after email send
- [ ] Use `type: 'learning_reminder'`
- [ ] Wrap in try-catch to prevent failures
- [ ] Test locally with Supabase CLI
- [ ] Deploy updated function
- [ ] Verify notification sends at scheduled time

#### Lunch Test Function
- [ ] Open `supabase/functions/lunch-test/index.ts`
- [ ] Add push notification for test reminder
- [ ] Use custom payload with test context
- [ ] Deploy updated function
- [ ] Test notification delivery

#### Evening Review Function
- [ ] Open `supabase/functions/evening-review/index.ts`
- [ ] Add streak celebration logic (7, 14, 21, 30 days)
- [ ] Add review reminder for postponed words
- [ ] Use appropriate notification types
- [ ] Deploy updated function
- [ ] Test with mock data

### 9. Scheduled Jobs Configuration
- [ ] Verify cron jobs are set up in Supabase
- [ ] Morning: 8:00 AM KST
- [ ] Lunch: 12:00 PM KST
- [ ] Evening: 8:00 PM KST
- [ ] Test each scheduled job
- [ ] Monitor execution logs

## Production Deployment

### 10. Production Environment
- [ ] Add VAPID keys to production `.env`
- [ ] Verify Supabase production project has secrets set
- [ ] Deploy edge functions to production
- [ ] Run database migration on production
- [ ] Update CORS settings if needed
- [ ] Verify HTTPS is enabled (required!)

### 11. Production Testing
- [ ] Create test user account
- [ ] Subscribe to notifications
- [ ] Wait for scheduled notifications
- [ ] Verify morning notification (8 AM)
- [ ] Verify lunch notification (12 PM)
- [ ] Verify evening notification (8 PM)
- [ ] Test unsubscribe flow
- [ ] Test re-subscribe flow

### 12. Monitoring Setup
- [ ] Set up Supabase dashboard monitoring
- [ ] Track edge function invocations
- [ ] Monitor database for subscription growth
- [ ] Set up error alerting
- [ ] Track notification delivery rates
- [ ] Monitor for 410 errors (expired subscriptions)

## Post-Deployment

### 13. User Communication
- [ ] Announce new feature to users
- [ ] Create user guide for enabling notifications
- [ ] Update FAQ with notification info
- [ ] Provide troubleshooting guide
- [ ] Set expectations for notification timing

### 14. Performance Monitoring
- [ ] Track subscription rate
- [ ] Monitor delivery success rate
- [ ] Measure click-through rate
- [ ] Track unsubscribe rate
- [ ] Identify and fix issues

### 15. Optimization
- [ ] A/B test notification content
- [ ] Optimize notification timing
- [ ] Improve notification copy
- [ ] Add quiet hours feature
- [ ] Implement user preferences

## Troubleshooting Checklist

If notifications aren't working:

### Client-Side Issues
- [ ] Check browser supports push notifications
- [ ] Verify Notification.permission === 'granted'
- [ ] Check service worker is registered
- [ ] Verify VAPID public key is set correctly
- [ ] Check browser console for errors
- [ ] Try incognito/private mode
- [ ] Clear service worker and re-register

### Server-Side Issues
- [ ] Check Supabase edge function logs
- [ ] Verify secrets are set correctly
- [ ] Check database for subscription record
- [ ] Verify subscription.enabled === true
- [ ] Test edge function directly
- [ ] Check VAPID keys match
- [ ] Verify HTTPS is enabled

### Database Issues
- [ ] Verify table exists
- [ ] Check RLS policies
- [ ] Verify indexes are created
- [ ] Check for orphaned subscriptions
- [ ] Clean up invalid subscriptions (410 errors)

## Security Checklist

- [ ] VAPID keys are not in version control
- [ ] `.env.local` is in `.gitignore`
- [ ] RLS policies are enabled on `push_subscriptions`
- [ ] HTTPS is required in production
- [ ] Service role key is secure
- [ ] API endpoints validate input
- [ ] Rate limiting is considered
- [ ] User consent is obtained before subscribing

## Documentation Checklist

- [ ] `PUSH_NOTIFICATIONS_SETUP.md` is complete
- [ ] `PUSH_INTEGRATION_EXAMPLE.md` has examples
- [ ] `docs/PUSH_NOTIFICATIONS_README.md` is comprehensive
- [ ] `.env.local.example` is updated
- [ ] Code comments are clear
- [ ] API endpoints are documented
- [ ] Troubleshooting guide is helpful

## Maintenance Tasks

### Weekly
- [ ] Check edge function logs for errors
- [ ] Monitor subscription growth
- [ ] Review notification delivery rates
- [ ] Check for 410 errors (expired subscriptions)

### Monthly
- [ ] Review notification metrics
- [ ] Clean up invalid subscriptions
- [ ] Update notification content if needed
- [ ] Check for new browser compatibility issues
- [ ] Review and optimize costs

### Quarterly
- [ ] Analyze user engagement
- [ ] Plan feature improvements
- [ ] Update documentation
- [ ] Review security practices
- [ ] Test disaster recovery

## Success Criteria

- [ ] 80%+ of active users subscribe to notifications
- [ ] 95%+ delivery success rate
- [ ] <5% unsubscribe rate
- [ ] Zero critical errors in production
- [ ] Positive user feedback
- [ ] Notifications arrive on schedule
- [ ] All browsers work correctly
- [ ] Performance meets expectations

## Completion

- [ ] All checklist items completed
- [ ] Production deployment successful
- [ ] Users receiving notifications
- [ ] Monitoring in place
- [ ] Documentation complete
- [ ] Team trained on system

**Date Completed**: _______________
**Completed By**: _______________
**Notes**: _______________
