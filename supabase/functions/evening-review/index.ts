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

    // Get today's words
    const { data: words } = await supabase
      .from('words')
      .select('word, meaning')
      .eq('day', currentDay)
      .order('id')

    if (!words || words.length === 0) {
      return new Response(JSON.stringify({ error: `No words for Day ${currentDay}` }), {
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

    // Call Gemini API for review materials
    let geminiSection = ''
    try {
      const wordList = words.map((w: { word: string; meaning: string }, i: number) => `${i + 1}. ${w.word} (${w.meaning})`).join('\n')
      const prompt = `당신은 영어 학습 코치입니다.

오늘 학습한 단어들의 복습 자료를 만들어주세요:

${wordList}

다음 형식으로 작성:

[오늘의 핵심 정리]
- 헷갈리기 쉬운 단어 3개와 구분 팁
- 발음 주의 단어 (있다면)

[보너스: 오늘의 비즈니스 숙어]
위 단어 중 하나를 포함한 실용적인 비즈니스 숙어 1개
- 숙어와 뜻
- 예문
- 사용 상황

[내일 예고]
내일 학습을 위한 동기부여 한마디`

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
          .replace(/\[(.+?)\]/g, '<h3 style="color:#a78bfa;font-size:14px;margin:16px 0 8px;">$1</h3>')
          .replace(/\n- /g, '<br>• ')
          .replace(/\n\n/g, '<div style="height:8px;"></div>')
          .replace(/\n/g, '<br>')

        geminiSection = `
          <div style="background-color:#18181b;border:1px solid #8b5cf640;border-radius:12px;overflow:hidden;margin-bottom:20px;">
            <div style="padding:14px 16px;border-bottom:1px solid #27272a;background:linear-gradient(135deg,#8b5cf620,#7c3aed20);">
              <h2 style="color:#a78bfa;font-size:15px;margin:0;">🤖 AI 복습 자료</h2>
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

    // For each subscriber, get their wrong words
    const results = []
    for (const sub of subscribers) {
      // Get wrong words for this subscriber (not mastered)
      const { data: wrongWords } = await supabase
        .from('wrong_words')
        .select('word, meaning, wrong_count')
        .eq('email', sub.email)
        .eq('mastered', false)
        .order('wrong_count', { ascending: false })
        .limit(20)

      // Build wrong words section
      let wrongSection = ''
      if (wrongWords && wrongWords.length > 0) {
        const wrongRows = wrongWords.map((w: { word: string; meaning: string; wrong_count: number }, i: number) => `
          <tr>
            <td style="padding:10px 8px;color:#a1a1aa;font-size:13px;border-bottom:1px solid #27272a;text-align:center;">${i + 1}</td>
            <td style="padding:10px;color:#f87171;font-size:14px;font-weight:600;border-bottom:1px solid #27272a;">${w.word}</td>
            <td style="padding:10px;color:#a1a1aa;font-size:13px;border-bottom:1px solid #27272a;">${w.meaning}</td>
            <td style="padding:10px 8px;color:#f59e0b;font-size:12px;border-bottom:1px solid #27272a;text-align:center;">${w.wrong_count}회</td>
          </tr>
        `).join('')

        wrongSection = `
          <div style="background-color:#18181b;border:1px solid #dc2626;border-radius:12px;overflow:hidden;margin-bottom:20px;">
            <div style="padding:14px 16px;border-bottom:1px solid #27272a;background-color:#7f1d1d20;">
              <h2 style="color:#f87171;font-size:15px;margin:0;">❌ 오답 노트 (${wrongWords.length}개)</h2>
            </div>
            <table style="width:100%;border-collapse:collapse;">
              ${wrongRows}
            </table>
          </div>
        `
      } else {
        wrongSection = `
          <div style="background-color:#18181b;border:1px solid #27272a;border-radius:12px;padding:20px;margin-bottom:20px;text-align:center;">
            <div style="font-size:32px;margin-bottom:8px;">🎉</div>
            <p style="color:#10b981;font-size:15px;font-weight:600;margin:0 0 4px;">오답이 없습니다!</p>
            <p style="color:#71717a;font-size:13px;margin:0;">모든 단어를 완벽하게 학습하셨네요</p>
          </div>
        `
      }

      // Build today's words review
      const wordRows = words.map((w: { word: string; meaning: string }, i: number) => `
        <tr>
          <td style="padding:10px 8px;color:#a1a1aa;font-size:13px;border-bottom:1px solid #27272a;text-align:center;">${i + 1}</td>
          <td style="padding:10px;color:#f4f4f5;font-size:14px;font-weight:600;border-bottom:1px solid #27272a;">${w.word}</td>
          <td style="padding:10px;color:#a1a1aa;font-size:13px;border-bottom:1px solid #27272a;">${w.meaning}</td>
        </tr>
      `).join('')

      // Calculate progress
      const progressPercent = Math.round((currentDay / totalDays) * 100)
      const nextDay = currentDay + 1

      const html = `<!DOCTYPE html>
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
      <span style="display:inline-block;background:linear-gradient(135deg,#8b5cf6,#7c3aed);color:#fff;padding:6px 16px;border-radius:20px;font-size:13px;font-weight:700;">
        🌙 Day ${currentDay} 저녁 복습
      </span>
    </div>

    <!-- Greeting -->
    <div style="background-color:#18181b;border:1px solid #27272a;border-radius:12px;padding:20px;margin-bottom:20px;">
      <p style="color:#f4f4f5;font-size:15px;margin:0 0 8px;">수고하셨습니다, <strong>${sub.name || '학습자'}</strong>님! 🎊</p>
      <p style="color:#a1a1aa;font-size:14px;margin:0;line-height:1.5;">
        Day ${currentDay} 학습을 완료하셨습니다.<br>
        오늘 배운 내용을 마지막으로 정리해보세요.
      </p>
    </div>

    <!-- Wrong Words Section -->
    ${wrongSection}

    <!-- Today's Full Review -->
    <div style="background-color:#18181b;border:1px solid #27272a;border-radius:12px;overflow:hidden;margin-bottom:20px;">
      <div style="padding:14px 16px;border-bottom:1px solid #27272a;">
        <h2 style="color:#f4f4f5;font-size:15px;margin:0;">📖 오늘의 전체 단어 복습</h2>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        ${wordRows}
      </table>
    </div>

    <!-- Gemini Review Materials -->
    ${geminiSection}

    <!-- Progress Bar -->
    <div style="background-color:#18181b;border:1px solid #27272a;border-radius:12px;padding:20px;margin-bottom:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <span style="color:#f4f4f5;font-size:14px;font-weight:600;">📊 전체 진도</span>
        <span style="color:#8b5cf6;font-size:14px;font-weight:700;">${progressPercent}%</span>
      </div>
      <div style="background-color:#27272a;border-radius:8px;height:8px;overflow:hidden;">
        <div style="background:linear-gradient(90deg,#8b5cf6,#a78bfa);height:100%;width:${progressPercent}%;border-radius:8px;"></div>
      </div>
      <p style="color:#71717a;font-size:12px;margin:8px 0 0;text-align:center;">
        Day ${currentDay} / ${totalDays} 완료
      </p>
    </div>

    <!-- Tomorrow Preview -->
    ${nextDay <= totalDays ? `
    <div style="background-color:#18181b;border:1px solid #27272a;border-radius:12px;padding:20px;text-align:center;">
      <p style="color:#f4f4f5;font-size:14px;margin:0 0 4px;">내일은 <strong style="color:#f59e0b;">Day ${nextDay}</strong>입니다</p>
      <p style="color:#71717a;font-size:13px;margin:0;">새로운 단어와 함께 내일 아침에 만나요! 🌅</p>
    </div>
    ` : `
    <div style="background-color:#18181b;border:1px solid #f59e0b;border-radius:12px;padding:20px;text-align:center;">
      <div style="font-size:32px;margin-bottom:8px;">🏆</div>
      <p style="color:#f59e0b;font-size:16px;font-weight:700;margin:0 0 4px;">축하합니다!</p>
      <p style="color:#a1a1aa;font-size:13px;margin:0;">모든 학습 과정을 완료하셨습니다!</p>
    </div>
    `}

    <!-- Footer -->
    <div style="text-align:center;padding:16px 0;">
      <p style="color:#52525b;font-size:12px;margin:0;">옛설판다 · 매일 성장하는 비즈니스 영어</p>
    </div>
  </div>
</body>
</html>`

      // Send email
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: '옛설판다 <onboarding@resend.dev>',
          to: [sub.email],
          subject: `🌙 Day ${currentDay} 저녁 복습 - 오늘의 학습 정리`,
          html,
        }),
      })

      const resBody = await res.json()
      results.push({
        email: sub.email,
        status: res.status,
        id: resBody.id || null,
        wrongCount: wrongWords?.length || 0,
      })

      // Record attendance
      await supabase.from('attendance').upsert(
        { email: sub.email, date: new Date().toISOString().slice(0, 10), type: 'evening', completed: true },
        { onConflict: 'email,date,type' }
      )
    }

    // Auto-advance day after evening review
    const nextDay = currentDay + 1
    if (nextDay <= totalDays) {
      await supabase.from('config').upsert(
        { key: 'CurrentDay', value: nextDay.toString(), updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )
    }

    return new Response(JSON.stringify({
      success: true,
      day: currentDay,
      nextDay: nextDay <= totalDays ? nextDay : null,
      sent: results.length,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('evening-review error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
