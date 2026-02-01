import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

    // Get config
    const { data: configData } = await supabase.from('config').select('key, value')
    const config: Record<string, string> = {}
    configData?.forEach((r: { key: string; value: string }) => { config[r.key] = r.value })
    const currentDay = parseInt(config.CurrentDay || '1')
    const totalDays = parseInt(config.TotalDays || '10')

    // Get words for current day
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

    // Build quiz: show Korean meaning → recall English word
    const shuffledWords = shuffleArray(words)
    const quizItems = shuffledWords.map((w: { word: string; meaning: string }, i: number) => `
      <div style="background-color:#18181b;border:1px solid #27272a;border-radius:10px;padding:16px;margin-bottom:10px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <span style="background-color:#27272a;color:#a1a1aa;width:24px;height:24px;border-radius:50%;display:inline-block;text-align:center;line-height:24px;font-size:12px;font-weight:700;">${i + 1}</span>
          <span style="color:#f4f4f5;font-size:15px;">${w.meaning}</span>
        </div>
        <div style="background-color:#09090b;border:1px dashed #3f3f46;border-radius:8px;padding:12px;text-align:center;">
          <span style="color:#52525b;font-size:13px;">영어 단어를 떠올려보세요</span>
        </div>
        <div style="margin-top:8px;text-align:right;">
          <span style="color:#3f3f46;font-size:12px;">정답: </span>
          <span style="color:#3f3f46;font-size:12px;background-color:#3f3f46;border-radius:4px;padding:1px 6px;cursor:pointer;" title="드래그하여 정답 확인">${w.word}</span>
        </div>
      </div>
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
      <span style="display:inline-block;background:linear-gradient(135deg,#3b82f6,#06b6d4);color:#fff;padding:6px 16px;border-radius:20px;font-size:13px;font-weight:700;">
        ✏️ Day ${currentDay} 아침 테스트
      </span>
    </div>

    <!-- Instructions -->
    <div style="background-color:#18181b;border:1px solid #27272a;border-radius:12px;padding:20px;margin-bottom:20px;">
      <p style="color:#f4f4f5;font-size:15px;margin:0 0 8px;"><strong>${name}</strong>님, 테스트 시간입니다!</p>
      <p style="color:#a1a1aa;font-size:14px;margin:0;line-height:1.5;">
        한국어 뜻을 보고 영어 단어를 떠올려보세요.<br>
        정답은 <strong style="color:#3b82f6;">드래그/선택</strong>하면 보입니다.
      </p>
    </div>

    <!-- Quiz Items -->
    ${quizItems}

    <!-- Score Section -->
    <div style="background-color:#18181b;border:1px solid #27272a;border-radius:12px;padding:20px;margin-top:20px;text-align:center;">
      <p style="color:#f4f4f5;font-size:15px;margin:0 0 4px;">총 <strong style="color:#3b82f6;">${words.length}개</strong> 중 몇 개를 맞추셨나요?</p>
      <p style="color:#71717a;font-size:13px;margin:0;">점심에 복습 테스트가 다시 발송됩니다 💪</p>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:16px 0;">
      <p style="color:#52525b;font-size:12px;margin:0;">옛설판다 · 매일 성장하는 비즈니스 영어</p>
    </div>
  </div>
</body>
</html>`

    // Send to each subscriber and record attendance
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
          subject: `✏️ Day ${currentDay} 아침 테스트 - 영어 단어를 맞춰보세요!`,
          html: buildHtml(sub.name || '학습자'),
        }),
      })

      const resBody = await res.json()
      results.push({ email: sub.email, status: res.status, id: resBody.id || null })

      // Record attendance
      await supabase.from('attendance').upsert(
        { email: sub.email, date: new Date().toISOString().slice(0, 10), type: 'morning', completed: true },
        { onConflict: 'email,date,type' }
      )
    }

    return new Response(JSON.stringify({ success: true, day: currentDay, quizWords: words.length, sent: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('morning-test error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
