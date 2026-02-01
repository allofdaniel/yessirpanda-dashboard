import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendKey = Deno.env.get('RESEND_API_KEY')!
    const geminiKey = Deno.env.get('GEMINI_API_KEY')!

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get config
    const { data: configData } = await supabase.from('config').select('key, value')
    const config: Record<string, string> = {}
    configData?.forEach((r: { key: string; value: string }) => { config[r.key] = r.value })
    const currentDay = parseInt(config.CurrentDay || '1')
    const totalDays = parseInt(config.TotalDays || '10')

    // Get words for current day
    const { data: words, error: wordsError } = await supabase
      .from('words')
      .select('word, meaning')
      .eq('day', currentDay)
      .order('id')

    if (wordsError) throw new Error(`DB error: ${wordsError.message}`)
    if (!words || words.length === 0) {
      return new Response(JSON.stringify({ error: `No words found for Day ${currentDay}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    // Get active subscribers
    const { data: subscribers } = await supabase
      .from('subscribers')
      .select('email, name')
      .eq('status', 'active')

    if (!subscribers || subscribers.length === 0) {
      return new Response(JSON.stringify({ error: 'No active subscribers' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    // Call Gemini API for business examples
    let geminiSection = ''
    try {
      const wordList = words.map((w: { word: string; meaning: string }, i: number) => `${i + 1}. ${w.word} (${w.meaning})`).join('\n')
      const prompt = `당신은 비즈니스 영어 전문가입니다.

다음 영어 단어들로 비즈니스 상황에서 사용할 수 있는 실용적인 예문을 각각 만들어주세요.

단어 목록:
${wordList}

각 단어마다 다음 형식으로 작성:
━━━━━━━━━━━━━━━━━━
[단어] - 뜻
예문: (영문)
해석: (한글)
━━━━━━━━━━━━━━━━━━

회의, 이메일, 협상 등 실제 비즈니스 맥락에서 바로 쓸 수 있는 자연스러운 예문으로 작성해주세요.`

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        }
      )
      const geminiData = await geminiRes.json()
      const geminiText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || ''

      if (geminiText) {
        const formattedText = geminiText
          .replace(/━+/g, '')
          .replace(/\[(.+?)\]\s*-\s*(.+)/g, '<strong style="color:#f59e0b;">$1</strong> <span style="color:#a1a1aa;">- $2</span>')
          .replace(/예문:\s*(.+)/g, '<div style="color:#e2e8f0;margin:4px 0;">📝 $1</div>')
          .replace(/해석:\s*(.+)/g, '<div style="color:#94a3b8;font-size:13px;">💬 $1</div>')
          .replace(/\n\n/g, '<div style="height:12px;"></div>')
          .replace(/\n/g, '<br>')

        geminiSection = `
          <div style="background-color:#18181b;border:1px solid #f59e0b40;border-radius:12px;overflow:hidden;margin-bottom:20px;">
            <div style="padding:14px 16px;border-bottom:1px solid #27272a;background:linear-gradient(135deg,#f59e0b20,#d9770620);">
              <h2 style="color:#f59e0b;font-size:15px;margin:0;">🤖 AI 비즈니스 예문</h2>
            </div>
            <div style="padding:16px;color:#e2e8f0;font-size:14px;line-height:1.6;">
              ${formattedText}
            </div>
          </div>
        `
      }
    } catch (geminiError) {
      console.error('Gemini API error:', geminiError)
      // Continue without Gemini content
    }

    // Build word list HTML
    const wordRows = words.map((w: { word: string; meaning: string }, i: number) => `
      <tr>
        <td style="padding:12px 8px;color:#a1a1aa;font-size:14px;border-bottom:1px solid #27272a;width:30px;text-align:center;">${i + 1}</td>
        <td style="padding:12px 10px;color:#f4f4f5;font-size:16px;font-weight:600;border-bottom:1px solid #27272a;">${w.word}</td>
        <td style="padding:12px 10px;color:#a1a1aa;font-size:14px;border-bottom:1px solid #27272a;">${w.meaning}</td>
      </tr>
    `).join('')

    const buildHtml = (name: string) => `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:24px 16px;">
    <!-- Header -->
    <div style="text-align:center;padding:24px 0;">
      <div style="font-size:40px;margin-bottom:8px;">🐼</div>
      <h1 style="color:#f4f4f5;font-size:22px;margin:0 0 4px;">옛설판다</h1>
      <p style="color:#71717a;font-size:13px;margin:0;">비즈니스 영어 마스터</p>
    </div>

    <!-- Day Badge -->
    <div style="text-align:center;margin-bottom:20px;">
      <span style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#d97706);color:#000;padding:6px 16px;border-radius:20px;font-size:13px;font-weight:700;">
        🌅 Day ${currentDay} / ${totalDays}
      </span>
    </div>

    <!-- Greeting -->
    <div style="background-color:#18181b;border:1px solid #27272a;border-radius:12px;padding:20px;margin-bottom:20px;">
      <p style="color:#f4f4f5;font-size:15px;margin:0 0 8px;">안녕하세요, <strong>${name}</strong>님!</p>
      <p style="color:#a1a1aa;font-size:14px;margin:0;line-height:1.5;">
        오늘의 비즈니스 영어 단어 <strong style="color:#f59e0b;">${words.length}개</strong>를 준비했습니다.
        각 단어를 소리 내어 읽으며 뜻을 익혀보세요.
      </p>
    </div>

    <!-- Word Table -->
    <div style="background-color:#18181b;border:1px solid #27272a;border-radius:12px;overflow:hidden;margin-bottom:20px;">
      <div style="padding:14px 16px;border-bottom:1px solid #27272a;">
        <h2 style="color:#f4f4f5;font-size:15px;margin:0;">📚 오늘의 단어</h2>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        ${wordRows}
      </table>
    </div>

    <!-- Gemini Business Examples -->
    ${geminiSection}

    <!-- Tips -->
    <div style="background-color:#18181b;border:1px solid #27272a;border-radius:12px;padding:20px;margin-bottom:20px;">
      <h3 style="color:#f4f4f5;font-size:14px;margin:0 0 10px;">💡 학습 팁</h3>
      <ul style="color:#a1a1aa;font-size:13px;margin:0;padding-left:18px;line-height:1.8;">
        <li>단어를 3번씩 소리 내어 읽어보세요</li>
        <li>각 단어로 간단한 문장을 만들어보세요</li>
        <li>잠시 후 테스트가 발송됩니다</li>
      </ul>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:16px 0;">
      <p style="color:#52525b;font-size:12px;margin:0;">옛설판다 · 매일 성장하는 비즈니스 영어</p>
    </div>
  </div>
</body>
</html>`

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
          from: '옛설판다 <onboarding@resend.dev>',
          to: [sub.email],
          subject: `🌅 Day ${currentDay} - 오늘의 비즈니스 영어 (${words.length}개)`,
          html: buildHtml(sub.name || '학습자'),
        }),
      })

      const resBody = await res.json()
      results.push({ email: sub.email, status: res.status, id: resBody.id || null })
    }

    return new Response(JSON.stringify({ success: true, day: currentDay, wordCount: words.length, sent: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('morning-words error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
