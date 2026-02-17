import { NextRequest } from 'next/server'
import { getServerClient } from '@/lib/supabase'
import { DEFAULT_ACTION_LINK_TTL_MS, sanitizeDay, sanitizeEmail, verifySignedActionToken } from '@/lib/auth-middleware'
import { checkRateLimit, responseRateLimited } from '@/lib/request-policy'

// GET /api/complete?email=xxx&day=N&token=...
export async function GET(request: NextRequest) {
  const rate = checkRateLimit('api:complete:get', request, {
    maxRequests: 120,
    windowMs: 60_000,
  })
  if (!rate.allowed) {
    return responseRateLimited(rate.retryAfter || 1, 'api:complete:get')
  }

  const email = sanitizeEmail(request.nextUrl.searchParams.get('email'))
  const day = sanitizeDay(request.nextUrl.searchParams.get('day'))
  const token = request.nextUrl.searchParams.get('token')

  if (!email || !day || !token) {
    return new Response(buildHtml('Invalid confirmation request', false), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      status: 400,
    })
  }

  const valid = verifySignedActionToken(token, {
    action: 'complete',
    email,
    day: String(day),
    maxAgeMs: DEFAULT_ACTION_LINK_TTL_MS,
  })

  if (!valid) {
    return new Response(buildHtml('Invalid or expired confirmation link', false), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      status: 403,
    })
  }

  try {
    const supabase = getServerClient()
    const today = new Date().toISOString().slice(0, 10)

    const { data: existing } = await supabase
      .from('attendance')
      .select('id')
      .eq('email', email)
      .eq('type', 'lunch')
      .eq('date', today)
      .single()

    if (existing) {
      return new Response(buildHtml(`Day ${day} is already marked complete`, true), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    await supabase.from('attendance').upsert(
      {
        email,
        date: today,
        type: 'lunch',
        completed: true,
      },
      { onConflict: 'email,date,type' }
    )

    return new Response(buildHtml(`Day ${day} has been marked as complete`, true), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch {
    return new Response(
      buildHtml('Failed to process attendance. Please try again.', false),
      {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        status: 500,
      },
    )
  }
}

function buildHtml(message: string, success: boolean) {
  const color = success ? '#10b981' : '#f87171'
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Attendance</title></head>
<body style="margin:0;background:#09090b;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui,sans-serif;">
<div style="text-align:center;padding:24px;">
<img src="/2.png" alt="icon" width="48" height="48" style="margin-bottom:12px;">
<p style="color:${color};font-size:16px;font-weight:700;margin:0 0 8px;">${message}</p>
<p style="color:#71717a;font-size:12px;margin:0;">This window will close automatically.</p>
</div>
<script>setTimeout(function(){window.close();},1500);</script>
</body></html>`
}

