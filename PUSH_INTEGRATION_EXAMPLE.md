# Push Notification Integration Examples

This document shows how to integrate push notifications into your existing Supabase Edge Functions.

## Example 1: Morning Words Function

Add push notifications to the `morning-words` function to remind users to study.

### Original Code (lines 192-210)
```typescript
// Send to each subscriber
const results = []
for (const sub of subscribers) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `옛설판다 <${emailFrom}>`,
      to: [sub.email],
      subject: `🌅 Day ${currentDay} - 오늘의 비즈니스 영어 (${words.length}개)`,
      html: buildHtml(sub.name || '학습자', sub.email),
    }),
  })

  const resBody = await res.json()
  results.push({ email: sub.email, status: res.status, id: resBody.id || null })
}
```

### Updated Code with Push Notifications
```typescript
// Send to each subscriber
const results = []
for (const sub of subscribers) {
  // Send email
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `옛설판다 <${emailFrom}>`,
      to: [sub.email],
      subject: `🌅 Day ${currentDay} - 오늘의 비즈니스 영어 (${words.length}개)`,
      html: buildHtml(sub.name || '학습자', sub.email),
    }),
  })

  const resBody = await res.json()
  results.push({ email: sub.email, status: res.status, id: resBody.id || null })

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
    console.error('Failed to send push notification:', pushError)
    // Don't fail the whole function if push fails
  }
}
```

## Example 2: Evening Review Function (Streak Celebration)

Add push notifications when users achieve streak milestones.

### Find the streak calculation code
Look for code that calculates the current streak, probably in `evening-review/index.ts`:

```typescript
// Example: After calculating streak
const currentStreak = calculateStreak(attendanceRecords)

// If it's a milestone (7, 14, 21, 30 days)
if (currentStreak > 0 && [7, 14, 21, 30].includes(currentStreak)) {
  // Send celebration push notification
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
    console.error('Failed to send streak celebration push:', pushError)
  }
}
```

## Example 3: Review Reminder for Postponed Words

Send reminders when users have postponed words to review.

### Check for postponed words
```typescript
// Query postponed words
const { data: postponedWords } = await supabase
  .from('progress')
  .select('word')
  .eq('email', subscriber.email)
  .eq('status', 'postponed')

const postponedCount = postponedWords?.length || 0

// Send reminder if there are postponed words
if (postponedCount > 0) {
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
          title: '🔄 복습 시간!',
          body: `미룬 단어 ${postponedCount}개를 복습할 시간입니다`,
          url: '/',
          tag: 'review-reminder',
          requireInteraction: false,
        },
      }),
    })
  } catch (pushError) {
    console.error('Failed to send review reminder push:', pushError)
  }
}
```

## Example 4: Lunch Test Function

Add push notification before sending the lunch test.

```typescript
// In lunch-test/index.ts
for (const sub of subscribers) {
  // Send push notification first
  try {
    await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: sub.email,
        payload: {
          title: '📝 점심 테스트',
          body: '오전에 학습한 단어를 테스트할 시간입니다',
          url: '/',
          tag: 'lunch-test',
          requireInteraction: false,
        },
      }),
    })
  } catch (pushError) {
    console.error('Failed to send lunch test push:', pushError)
  }

  // Then send email test...
  const emailRes = await fetch('https://api.resend.com/emails', {
    // ... existing email code
  })
}
```

## Example 5: Batch Push Notifications

Send push notifications to all active subscribers at once.

```typescript
// Get all active subscriber emails
const { data: subscribers } = await supabase
  .from('subscribers')
  .select('email')
  .eq('status', 'active')

const emails = subscribers?.map(s => s.email) || []

// Send batch push notification
if (emails.length > 0) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        emails: emails,
        type: 'learning_reminder',
      }),
    })
  } catch (pushError) {
    console.error('Failed to send batch push:', pushError)
  }
}
```

## Best Practices

1. **Don't fail the main function**: Wrap push notification calls in try-catch blocks so they don't crash your main email sending logic.

2. **Send push after email**: Send the push notification after successfully sending the email, not before.

3. **Use appropriate notification types**:
   - `learning_reminder`: For daily learning prompts
   - `streak_celebration`: For achievement celebrations
   - `review_reminder`: For review prompts

4. **Customize messages**: Use the `payload` option for custom messages with dynamic content like streak counts or word counts.

5. **Set appropriate tags**: Use unique tags for different notification types to prevent duplicate notifications.

6. **Use requireInteraction wisely**: Only set to `true` for important celebrations, not for regular reminders.

## Scheduling Strategy

### Morning (8:00 AM)
- Trigger: `morning-words` function
- Notification: `learning_reminder`
- Purpose: Start the day with new words

### Lunch (12:00 PM)
- Trigger: `lunch-test` function
- Notification: Custom test reminder
- Purpose: Quiz on morning words

### Evening (8:00 PM)
- Trigger: `evening-review` function
- Notifications:
  - `streak_celebration` (if milestone reached)
  - `review_reminder` (if postponed words exist)
- Purpose: Daily wrap-up and motivation

## Testing Your Integration

1. **Test individual notification**:
   ```bash
   curl -X POST http://localhost:3000/api/push/test \
     -H "Content-Type: application/json" \
     -d '{"email":"your-email@example.com"}'
   ```

2. **Test edge function locally**:
   ```bash
   supabase functions serve send-push
   ```

3. **Check browser console**: Look for service worker logs

4. **Monitor Supabase logs**: Check edge function execution logs in dashboard

## Troubleshooting

### Push not received
1. Check if user has enabled notifications in settings
2. Verify push subscription exists in database
3. Check edge function logs for errors
4. Ensure VAPID keys are correctly configured

### 410 Gone error
- Subscription expired, user needs to re-subscribe
- Your code should handle this gracefully

### Permission denied
- User hasn't granted notification permission
- Check notification settings in browser

## Next Steps

After integrating push notifications:

1. Monitor delivery rates in Supabase dashboard
2. Track user engagement with notifications
3. A/B test notification timing and content
4. Add analytics for notification clicks
5. Implement quiet hours based on user timezone
