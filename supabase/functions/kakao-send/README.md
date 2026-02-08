# KakaoTalk Message Send Function

This Supabase Edge Function sends daily word notifications via KakaoTalk using Solapi's Alimtalk (알림톡) API.

## Overview

- **Channel ID**: `_AmrRX`
- **App ID**: `1381223`
- **Template ID**: `129026`
- **API Provider**: [Solapi](https://docs.solapi.com/)

## Features

- Sends daily words to subscribers who have 'kakao' in their channels array
- Supports three message types: `morning`, `test`, and `review`
- Includes postpone button functionality
- Uses Solapi's Alimtalk API with template-based messaging
- Personalized messages with user names and email-specific links

## Environment Variables

Set these in Supabase Dashboard → Edge Functions → Secrets:

```bash
SOLAPI_API_KEY=your_solapi_api_key
SOLAPI_API_SECRET=your_solapi_api_secret
SOLAPI_PF_ID=_AmrRX                    # KakaoTalk Channel PF ID
SOLAPI_SENDER=01012345678              # Registered sender phone number
DASHBOARD_URL=https://your-dashboard-url.vercel.app
```

## Message Types

### 1. Morning Words (`type: 'morning'`)
- Sends daily vocabulary list
- Includes test button, postpone button, and dashboard link
- Default message type if not specified

### 2. Lunch Test (`type: 'test'`)
- Reminds users to take the quiz
- Includes test button and postpone button

### 3. Evening Review (`type: 'review'`)
- Prompts evening review session
- Includes review button and wrong words notebook link

## API Usage

### Invoke via Supabase CLI
```bash
# Send morning words
supabase functions invoke kakao-send --data '{"type":"morning"}'

# Send test reminder
supabase functions invoke kakao-send --data '{"type":"test"}'

# Send evening review
supabase functions invoke kakao-send --data '{"type":"review"}'
```

### Invoke via HTTP
```bash
curl -X POST 'https://[project-ref].supabase.co/functions/v1/kakao-send' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"type":"morning"}'
```

## Database Requirements

### Subscribers Table
Subscribers must have:
- `status = 'active'`
- `channels` array containing `'kakao'`
- Valid `phone` number for KakaoTalk delivery

Example:
```sql
UPDATE subscribers
SET channels = array_append(channels, 'kakao'),
    phone = '01012345678'
WHERE email = 'user@example.com';
```

### Adding Kakao Channel to Subscriber
Use the helper function:
```sql
SELECT add_channel_to_subscriber('user@example.com', 'kakao');
```

## Button Actions

All messages include interactive buttons:

1. **Test/Review Button**: Opens quiz page with email parameter
2. **Postpone Button**: Allows users to skip today and study tomorrow
3. **Dashboard Button**: Links to main dashboard (morning only)
4. **Wrong Words Notebook**: Links to incorrect answers (review only)

## Postpone Functionality

The postpone button:
- Adds current day to user's `postponed_days` array
- Records postponement in attendance table
- Allows re-learning postponed days later
- API endpoint: `/api/postpone`

## Template Configuration

The Solapi template (ID: 129026) should be configured in Solapi Dashboard:
- Template type: Alimtalk (알림톡)
- Channel: _AmrRX
- Buttons: Dynamic (up to 3 buttons supported)
- Variables: Message text is dynamic

## Testing

### Without Solapi Credentials
If credentials are not set, the function returns:
```json
{
  "success": true,
  "type": "morning",
  "day": 1,
  "message": "...",
  "buttons": [...],
  "templateId": "129026",
  "subscribers": [...],
  "note": "Solapi credentials not configured..."
}
```

### With Solapi Credentials
Returns:
```json
{
  "success": true,
  "type": "morning",
  "day": 1,
  "sent": 5,
  "total": 5,
  "results": [
    {"email": "user@example.com", "status": "sent", "result": {...}},
    ...
  ]
}
```

## Error Handling

- Missing phone numbers: Skipped with status `'skipped'`
- API errors: Caught and returned with status `'error'`
- Invalid day: Returns 404 error
- No subscribers: Returns 404 error

## Integration with Other Functions

This function is typically scheduled via cron jobs:
- **Morning**: 8:00 AM - Send daily words
- **Lunch**: 12:00 PM - Send test reminder
- **Evening**: 8:00 PM - Send review prompt

## Security Notes

- Uses HMAC-SHA256 authentication for Solapi API
- Service role key used for database access
- Phone numbers are validated before sending
- Email addresses are URL-encoded in button links

## Related Files

- `/src/app/api/kakao/webhook/route.ts` - Interactive webhook for user commands
- `/src/app/api/postpone/route.ts` - Postpone day functionality
- `/supabase/migrations/20260204_add_sns_and_postpone.sql` - Database schema

## Support

For Solapi API documentation: https://docs.solapi.com/
For KakaoTalk channel management: Kakao Developers Console
