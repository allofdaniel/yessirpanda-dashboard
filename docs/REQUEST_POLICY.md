# Request Policy Guide

## Purpose

`request-policy` centralizes shared API protections:

- in-memory rate limiting
- lightweight replay cache for idempotent retry handling
- standard 429 response format with retry hint

## Applied Endpoints

- `auth callback`: `src/app/auth/callback/route.ts`
  - `checkRateLimit('auth:callback', request, { maxRequests: 120, windowMs: 60_000 })`
  - replay key: `hashPayload(request.url)`
  - fallback redirect on invalid replay URL: `/auth/login`
- `POST /api/quiz`: `src/app/api/quiz/route.ts`
  - `checkRateLimit('api:quiz:submit', request, { maxRequests: 30, windowMs: 60_000 })`
- `POST /api/push/test`: `src/app/api/push/test/route.ts`
  - `checkRateLimit('api:push:test', request, { maxRequests: 10, windowMs: 60_000 })`
- `GET /api/push/subscribe`: `src/app/api/push/subscribe/route.ts`
  - `checkRateLimit('api:push:subscribe:get', request, { maxRequests: 120, windowMs: 60_000 })`
- `POST /api/push/subscribe`: `src/app/api/push/subscribe/route.ts`
  - `checkRateLimit('api:push:subscribe', request, { maxRequests: 40, windowMs: 60_000 })`
- `GET /api/words`: `src/app/api/words/route.ts`
  - `checkRateLimit('api:words:get', request, { maxRequests: 120, windowMs: 60_000 })`
- `POST /api/config`: `src/app/api/config/route.ts`
  - `checkRateLimit('api:config', request, { maxRequests: 30, windowMs: 60_000 })`
- `POST /api/my/status`: `src/app/api/my/status/route.ts`
  - `checkRateLimit('api:my:status', request, { maxRequests: 120, windowMs: 60_000 })`
- `POST /api/my/progress`: `src/app/api/my/progress/route.ts`
  - `checkRateLimit('api:my:progress', request, { maxRequests: 60, windowMs: 60_000 })`
- `POST /api/my/mastered`: `src/app/api/my/mastered/route.ts`
  - `checkRateLimit('api:my:mastered', request, { maxRequests: 180, windowMs: 60_000 })`
- `POST /api/my/settings`: `src/app/api/my/settings/route.ts`
  - `checkRateLimit('api:my:settings', request, { maxRequests: 60, windowMs: 60_000 })`
- `POST /api/resend/add-contact`: `src/app/api/resend/add-contact/route.ts`
  - `checkRateLimit('api:resend:add-contact', request, { maxRequests: 30, windowMs: 60_000 })`
- `POST /api/kakao/webhook`: `src/app/api/kakao/webhook/route.ts`
  - `checkRateLimit('api:webhook:kakao', request, { maxRequests: 120, windowMs: 60_000 })`
- `POST /api/telegram/webhook`: `src/app/api/telegram/webhook/route.ts`
  - `checkRateLimit('api:webhook:telegram', request, { maxRequests: 120, windowMs: 60_000 })`
- `GET /api/invite/[code]`: `src/app/api/invite/[code]/route.ts`
  - `checkRateLimit('api:invite:code', request, { maxRequests: 120, windowMs: 60_000 })`
- `GET /api/attendance`: `src/app/api/attendance/route.ts`
  - `checkRateLimit('api:attendance:get', request, { maxRequests: 120, windowMs: 60_000 })`
- `GET /api/complete`: `src/app/api/complete/route.ts`
  - `checkRateLimit('api:complete:get', request, { maxRequests: 120, windowMs: 60_000 })`
- `GET /api/export`: `src/app/api/export/route.ts`
  - `checkRateLimit('api:export:get', request, { maxRequests: 20, windowMs: 60_000 })`
- `GET /api/my/admin`: `src/app/api/my/admin/route.ts`
  - `checkRateLimit('api:my:admin', request, { maxRequests: 120, windowMs: 60_000 })`
- `GET /api/my/invite`: `src/app/api/my/invite/route.ts`
  - `checkRateLimit('api:my:invite', request, { maxRequests: 120, windowMs: 60_000 })`
- `GET /api/my/stats`: `src/app/api/my/stats/route.ts`
  - `checkRateLimit('api:my:stats', request, { maxRequests: 120, windowMs: 60_000 })`
- `GET /api/relearn`: `src/app/api/relearn/route.ts`
  - `checkRateLimit('api:relearn:get', request, { maxRequests: 120, windowMs: 60_000 })`
- `GET /api/results`: `src/app/api/results/route.ts`
  - `checkRateLimit('api:results:get', request, { maxRequests: 120, windowMs: 60_000 })`
- `GET /api/wrong`: `src/app/api/wrong/route.ts`
  - `checkRateLimit('api:wrong:get', request, { maxRequests: 120, windowMs: 60_000 })`

## Response Convention

- On throttle:
  - return `responseRateLimited(retryAfter, scope)`
  - includes `Retry-After` header
  - body includes `code: 'RATE_LIMITED'` and optional `details.scope`
- Replay handling:
  - invalid redirect location in replay payload is redirected to `/auth/login` (fallback)

## Deployment Checklist

- [ ] Use consistent `service:action` scope names (`api:quiz:submit`)
- [ ] Choose limits by endpoint impact and abuse risk
- [ ] Track `Retry-After` and `429` in monitoring
- [ ] Add regression tests for throttle boundaries
