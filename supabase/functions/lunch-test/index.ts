import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BASE = 'https://dashboard-keprojects.vercel.app'

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendKey = Deno.env.get('RESEND_API_KEY')!

    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: configData } = await supabase.from('config').select('key, value')
    const config: Record<string, string> = {}
    configData?.forEach((r: { key: string; value: string }) => { config[r.key] = r.value })
    const currentDay = parseInt(config.CurrentDay || '1')

    const { data: words } = await supabase
      .from('words')
      .select('word, meaning')
      .eq('day', currentDay)
      .order('id')

    if (!words || words.length === 0) {
      return new Response(JSON.stringify({ error: `No words for Day ${currentDay}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404,
      })
    }

    const { data: subscribers } = await supabase
      .from('subscribers')
      .select('email, name')
      .eq('status', 'active')

    if (!subscribers || subscribers.length === 0) {
      return new Response(JSON.stringify({ error: 'No active subscribers' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404,
      })
    }

    const shuffled = shuffleArray(words)

    const buildHtml = (name: string, email: string) => {
      const e = encodeURIComponent(email)
      const completeLink = `${BASE}/api/complete?email=${e}&day=${currentDay}`

      const rows = shuffled.map((w: { word: string; meaning: string }, i: number) => {
        const relearnLink = `${BASE}/api/relearn?email=${e}&day=${currentDay}&word=${encodeURIComponent(w.word)}&meaning=${encodeURIComponent(w.meaning)}`
        return `<tr>
<td style="padding:4px 6px;color:#71717a;font-size:11px;border-bottom:1px solid #1e1e1e;text-align:center;width:20px;">${i + 1}</td>
<td style="padding:4px 6px;color:#f4f4f5;font-size:13px;font-weight:600;border-bottom:1px solid #1e1e1e;">${w.word}</td>
<td style="padding:4px 6px;color:#1a1a1a;font-size:11px;border-bottom:1px solid #1e1e1e;background:#1a1a1a;border-radius:2px;user-select:all;">${w.meaning}</td>
<td style="padding:4px 4px;border-bottom:1px solid #1e1e1e;text-align:center;width:44px;"><a href="${relearnLink}" style="color:#f87171;font-size:10px;text-decoration:none;background:#7f1d1d;padding:2px 6px;border-radius:4px;">재학습</a></td>
</tr>`
      }).join('')

      return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#09090b;font-family:system-ui,sans-serif;">
<div style="max-width:420px;margin:0 auto;padding:10px 8px;">
<div style="text-align:center;padding:8px 0;">
<span style="font-size:24px;">🐼</span>
<span style="color:#f4f4f5;font-size:15px;font-weight:700;vertical-align:middle;margin-left:4px;">Day ${currentDay} 점심 테스트</span>
</div>
<p style="color:#a1a1aa;font-size:12px;margin:0 0 6px;text-align:center;">${name}님, 뜻을 떠올려보세요 · 정답은 드래그</p>

<!-- Step 1: 학습 완료 먼저 -->
<div style="text-align:center;margin:0 0 8px;">
<a href="${completeLink}" style="display:inline-block;background:linear-gradient(135deg,#10b981,#14b8a6);color:#fff;text-decoration:none;padding:10px 40px;border-radius:8px;font-size:14px;font-weight:700;">① 학습 완료</a>
</div>
<p style="text-align:center;color:#71717a;font-size:11px;margin:0 0 8px;">완료 후, 아래에서 재학습할 단어를 눌러주세요 ↓</p>

<!-- Step 2: 단어 테이블 + 재학습 -->
<table style="width:100%;border-collapse:collapse;background:#111;">
<tr style="background:#18181b;"><th style="padding:4px 6px;color:#71717a;font-size:10px;text-align:left;">#</th><th style="padding:4px 6px;color:#71717a;font-size:10px;text-align:left;">단어</th><th style="padding:4px 6px;color:#71717a;font-size:10px;text-align:left;">정답</th><th style="padding:4px;color:#71717a;font-size:10px;text-align:center;">②</th></tr>
${rows}
</table>
<div style="text-align:center;margin:10px 0 6px;">
<a href="${BASE}/login" style="display:inline-block;background:#8B5CF6;color:#fff;text-decoration:none;padding:8px 20px;border-radius:8px;font-size:12px;font-weight:600;">📊 내 학습 관리</a>
</div>
<p style="text-align:center;color:#3f3f46;font-size:9px;margin:6px 0 0;">옛설판다 · 비즈니스 영어</p>
</div>
</body></html>`
    }

    const results = []
    for (const sub of subscribers) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: '옛설판다 <onboarding@resend.dev>',
          to: [sub.email],
          subject: `🍽️ Day ${currentDay} 점심 테스트`,
          html: buildHtml(sub.name || '학습자', sub.email),
        }),
      })

      const resBody = await res.json()
      results.push({ email: sub.email, status: res.status, id: resBody.id || null })
    }

    return new Response(JSON.stringify({ success: true, day: currentDay, sent: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('lunch-test error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    })
  }
})
