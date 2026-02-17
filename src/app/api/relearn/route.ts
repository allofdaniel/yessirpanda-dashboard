import { NextRequest } from 'next/server'
import { getServerClient } from '@/lib/supabase'
import { DEFAULT_ACTION_LINK_TTL_MS, sanitizeDay, sanitizeEmail, verifySignedActionToken } from '@/lib/auth-middleware'
import { checkRateLimit, responseRateLimited } from '@/lib/request-policy'

// GET /api/relearn?email=xxx&day=N&word=xxx&meaning=yyy&token=...
export async function GET(request: NextRequest) {
  const rate = checkRateLimit('api:relearn:get', request, {
    maxRequests: 120,
    windowMs: 60_000,
  })
  if (!rate.allowed) {
    return responseRateLimited(rate.retryAfter || 1, 'api:relearn:get')
  }

  const email = sanitizeEmail(request.nextUrl.searchParams.get('email'))
  const day = sanitizeDay(request.nextUrl.searchParams.get('day'))
  const word = request.nextUrl.searchParams.get('word')?.trim()
  const meaning = request.nextUrl.searchParams.get('meaning') || ''
  const token = request.nextUrl.searchParams.get('token')

  if (!email || !day || !word || !token) {
    return new Response(closePage('Invalid action request', false), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      status: 400,
    })
  }

  const valid = verifySignedActionToken(token, {
    action: 'relearn',
    email,
    day: String(day),
    extra: word,
    maxAgeMs: DEFAULT_ACTION_LINK_TTL_MS,
  })

  if (!valid) {
    return new Response(closePage('Invalid or expired action link', false), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      status: 403,
    })
  }

  try {
    const supabase = getServerClient()

    // Upsert wrong word
    const { data: existing } = await supabase
      .from('wrong_words')
      .select('wrong_count')
      .eq('email', email)
      .eq('word', word)
      .single()

    const count = existing?.wrong_count || 0

    await supabase.from('wrong_words').upsert(
      {
        email,
        word,
        meaning,
        wrong_count: count + 1,
        last_wrong: new Date().toISOString(),
        mastered: false,
      },
      { onConflict: 'email,word' }
    )

    return new Response(closePage(`"${word}" has been added to review list`, true), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch {
    return new Response(
      closePage('Failed to record review word. Please try again.', false),
      {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        status: 500,
      },
    )
  }
}

function closePage(message: string, success: boolean) {
  const color = success ? '#10b981' : '#f87171'
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Relearn</title></head>
<body style="margin:0;background:#09090b;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui,sans-serif;">
<div style="text-align:center;padding:24px;">
<img src="/2.png" alt="icon" width="48" height="48" style="margin-bottom:12px;">
<p style="color:${color};font-size:16px;font-weight:700;margin:0 0 8px;">${message}</p>
<p style="color:#71717a;font-size:12px;margin:0;">This window will close automatically.</p>
</div>
<script>setTimeout(function(){window.close();},1500);</script>
</body></html>`
}

