# Quick Start Guide - KakaoTalk Send Function

## Prerequisites Checklist

- [ ] Solapi account created
- [ ] Solapi API Key and Secret obtained
- [ ] Kakao Channel created (ID: _AmrRX)
- [ ] Sender phone number registered in Solapi
- [ ] Template 129026 created and approved in Solapi

## 5-Minute Setup

### Step 1: Set Environment Variables (2 min)

In Supabase Dashboard → Settings → Edge Functions → Add secret:

```
SOLAPI_API_KEY = [your-api-key]
SOLAPI_API_SECRET = [your-api-secret]
SOLAPI_PF_ID = _AmrRX
SOLAPI_SENDER = 01012345678
DASHBOARD_URL = https://dashboard-keprojects.vercel.app
```

### Step 2: Deploy Function (1 min)

```bash
cd dashboard
supabase functions deploy kakao-send
```

### Step 3: Enable KakaoTalk for Test User (1 min)

```sql
-- In Supabase SQL Editor
UPDATE subscribers
SET
  channels = array_append(COALESCE(channels, '{}'), 'kakao'),
  phone = '01012345678'  -- Replace with test phone number
WHERE email = 'test@example.com';
```

### Step 4: Test Send (1 min)

```bash
# Via Supabase CLI (preview mode - no actual send)
supabase functions invoke kakao-send --data '{"type":"morning"}'

# Via curl (with credentials - actual send)
curl -X POST 'https://[project-ref].supabase.co/functions/v1/kakao-send' \
  -H 'Authorization: Bearer [anon-key]' \
  -H 'Content-Type: application/json' \
  -d '{"type":"morning"}'
```

## Quick Commands

### Test All Message Types
```bash
# Morning words
supabase functions invoke kakao-send --data '{"type":"morning"}'

# Lunch test reminder
supabase functions invoke kakao-send --data '{"type":"test"}'

# Evening review
supabase functions invoke kakao-send --data '{"type":"review"}'
```

### Add Kakao Channel to User
```sql
-- Method 1: Direct update
UPDATE subscribers SET channels = array_append(channels, 'kakao') WHERE email = 'user@email.com';

-- Method 2: Helper function
SELECT add_channel_to_subscriber('user@email.com', 'kakao');
```

### Check Subscribers with KakaoTalk
```sql
SELECT email, name, phone, channels
FROM subscribers
WHERE 'kakao' = ANY(channels);
```

### Remove Kakao Channel
```sql
UPDATE subscribers
SET channels = array_remove(channels, 'kakao')
WHERE email = 'user@email.com';
```

## Expected Responses

### Success (Preview Mode - No Credentials)
```json
{
  "success": true,
  "type": "morning",
  "day": 1,
  "message": "🐼 옛설판다 Day 1...",
  "buttons": [...],
  "templateId": "129026",
  "subscribers": [{"email": "...", "hasPhone": true}],
  "note": "Solapi credentials not configured..."
}
```

### Success (Live Send - With Credentials)
```json
{
  "success": true,
  "type": "morning",
  "day": 1,
  "sent": 3,
  "total": 3,
  "results": [
    {"email": "user@email.com", "status": "sent", "result": {...}}
  ]
}
```

### Error: No Subscribers
```json
{
  "error": "No subscribers with KakaoTalk channel enabled"
}
```

### Error: No Words
```json
{
  "error": "No words for Day 1"
}
```

## Troubleshooting

### Issue: "No subscribers with KakaoTalk channel enabled"
**Solution**: Add 'kakao' to channels array
```sql
UPDATE subscribers SET channels = array_append(channels, 'kakao') WHERE email = 'user@example.com';
```

### Issue: Status "skipped" - No phone number
**Solution**: Add phone number
```sql
UPDATE subscribers SET phone = '01012345678' WHERE email = 'user@example.com';
```

### Issue: Solapi API error
**Check**:
1. API credentials are correct
2. Sender phone number is registered and verified in Solapi
3. Template 129026 exists and is approved
4. Channel _AmrRX is active

### Issue: Template not found
**Solution**: Create template in Solapi Dashboard
- Type: Alimtalk (알림톡)
- Channel: _AmrRX
- Template ID: 129026
- Content: Dynamic (set via API)

## Button Link Format

All buttons use this URL structure:
- Test: `${dashboardUrl}/quiz?day={day}&email={email}`
- Postpone: `${dashboardUrl}/postpone?email={email}&day={day}`
- Dashboard: `${dashboardUrl}/login`
- Wrong Words: `${dashboardUrl}/wrong`

## Monitoring

### View Logs
```bash
supabase functions logs kakao-send
```

### Real-time Logs
```bash
supabase functions logs kakao-send --tail
```

### Check Function Status
```bash
supabase functions list
```

## Production Deployment

### Set up Cron Jobs (via Supabase or external scheduler)

```yaml
# Example cron schedule
morning:
  schedule: "0 8 * * *"  # 8:00 AM daily
  endpoint: https://[project].supabase.co/functions/v1/kakao-send
  body: {"type": "morning"}

lunch:
  schedule: "0 12 * * *"  # 12:00 PM daily
  endpoint: https://[project].supabase.co/functions/v1/kakao-send
  body: {"type": "test"}

evening:
  schedule: "0 20 * * *"  # 8:00 PM daily
  endpoint: https://[project].supabase.co/functions/v1/kakao-send
  body: {"type": "review"}
```

## Quick Reference

| Action | Command |
|--------|---------|
| Deploy | `supabase functions deploy kakao-send` |
| Test locally | `supabase functions invoke kakao-send --data '{"type":"morning"}'` |
| View logs | `supabase functions logs kakao-send` |
| Add channel | `UPDATE subscribers SET channels = array_append(channels, 'kakao') WHERE email = '...'` |
| Check users | `SELECT * FROM subscribers WHERE 'kakao' = ANY(channels)` |

## Need Help?

1. Check function logs: `supabase functions logs kakao-send --tail`
2. Verify environment variables are set in Supabase Dashboard
3. Test in preview mode first (without credentials)
4. Confirm database has subscribers with 'kakao' channel
5. Check Solapi Dashboard for delivery status

## Example: Complete Subscriber Setup

```sql
-- Add a new subscriber with KakaoTalk enabled
INSERT INTO subscribers (email, name, phone, status, channels)
VALUES (
  'newuser@example.com',
  '홍길동',
  '01012345678',
  'active',
  ARRAY['email', 'kakao']
);

-- Or update existing subscriber
UPDATE subscribers
SET
  phone = '01012345678',
  channels = array_append(COALESCE(channels, '{}'), 'kakao')
WHERE email = 'existing@example.com';
```

## Testing Checklist

- [ ] Function deployed successfully
- [ ] Environment variables set
- [ ] At least one subscriber has 'kakao' in channels array
- [ ] Subscriber has valid phone number
- [ ] Words exist for current day in database
- [ ] Preview mode returns expected message
- [ ] Live mode sends successfully (check phone)
- [ ] Buttons redirect to correct URLs
- [ ] Postpone button works

---

**Ready to Go?** Run `supabase functions deploy kakao-send` and test with `supabase functions invoke kakao-send --data '{"type":"morning"}'`
