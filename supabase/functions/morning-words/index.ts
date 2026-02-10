import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Subscriber {
  email: string
  name: string | null
  current_day: number
  active_days: number[] | null
}

interface Word {
  word: string
  meaning: string
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
    const dashboardUrl = Deno.env.get('DASHBOARD_URL') || 'https://dashboard-keprojects.vercel.app'
    const emailFrom = Deno.env.get('EMAIL_FROM') || 'onboarding@resend.dev'

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get config for total days
    const { data: configData } = await supabase.from('config').select('key, value')
    const config: Record<string, string> = {}
    configData?.forEach((r: { key: string; value: string }) => { config[r.key] = r.value })
    const totalDays = parseInt(config.TotalDays || '90')

    // Get today's day of week (0=Sun, 1=Mon, ..., 6=Sat)
    const todayDayOfWeek = new Date().getDay()

    // Get active subscribers with their personal current_day
    // Note: active_days column removed from SELECT until migration is applied
    const { data: subscribers, error: subError } = await supabase
      .from('subscribers')
      .select('email, name, current_day')
      .eq('status', 'active')

    if (subError) throw new Error(`DB error: ${subError.message}`)
    if (!subscribers || subscribers.length === 0) {
      return new Response(JSON.stringify({ error: 'No active subscribers' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    // Get notification settings for each subscriber
    const { data: settingsData } = await supabase
      .from('subscriber_settings')
      .select('email, email_enabled')

    const settingsMap = new Map<string, boolean>()
    settingsData?.forEach((s: { email: string; email_enabled: boolean | null }) => {
      settingsMap.set(s.email, s.email_enabled !== false)
    })

    // Filter subscribers:
    // 1. Email enabled (default true)
    // 2. Today is in their active_days (default Mon-Fri = [1,2,3,4,5])
    const eligibleSubscribers = (subscribers as Subscriber[]).filter(sub => {
      const emailEnabled = settingsMap.get(sub.email) !== false
      const activeDays = sub.active_days || [1, 2, 3, 4, 5] // Default: Mon-Fri
      const isTodayActive = activeDays.includes(todayDayOfWeek)
      return emailEnabled && isTodayActive
    })

    if (eligibleSubscribers.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No eligible subscribers for today',
        skippedByDayOfWeek: subscribers.length
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Group subscribers by their current_day to batch fetch words
    const subscribersByDay = new Map<number, Subscriber[]>()
    for (const sub of eligibleSubscribers) {
      const day = sub.current_day || 1
      if (!subscribersByDay.has(day)) {
        subscribersByDay.set(day, [])
      }
      subscribersByDay.get(day)!.push(sub)
    }

    // Fetch words for all needed days
    const neededDays = Array.from(subscribersByDay.keys())
    const { data: allWords, error: wordsError } = await supabase
      .from('words')
      .select('day, word, meaning')
      .in('day', neededDays)
      .order('id')

    if (wordsError) throw new Error(`DB error: ${wordsError.message}`)

    // Group words by day
    const wordsByDay = new Map<number, Word[]>()
    allWords?.forEach((w: { day: number; word: string; meaning: string }) => {
      if (!wordsByDay.has(w.day)) {
        wordsByDay.set(w.day, [])
      }
      wordsByDay.get(w.day)!.push({ word: w.word, meaning: w.meaning })
    })

    // Cache for Gemini responses by day
    const geminiCache = new Map<number, string>()

    // Generate Gemini examples for a day's words
    const generateGeminiSection = async (words: Word[], day: number): Promise<string> => {
      if (geminiCache.has(day)) {
        return geminiCache.get(day)!
      }

      try {
        const wordList = words.map((w, i) => `${i + 1}. ${w.word} (${w.meaning})`).join('\n')
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
            .replace(/예문:\s*(.+)/g, '<div style="color:#e2e8f0;margin:2px 0;">📝 $1</div>')
            .replace(/해석:\s*(.+)/g, '<div style="color:#94a3b8;font-size:12px;">💬 $1</div>')
            .replace(/\n\n/g, '<div style="height:6px;"></div>')
            .replace(/\n/g, '<br>')

          const section = `
            <div style="background:#18181b;border:1px solid #f59e0b40;border-radius:10px;overflow:hidden;margin-bottom:12px;">
              <div style="padding:10px 14px;border-bottom:1px solid #27272a;background:linear-gradient(135deg,#f59e0b20,#d9770620);">
                <h2 style="color:#f59e0b;font-size:14px;margin:0;">🤖 AI 비즈니스 예문</h2>
              </div>
              <div style="padding:12px 14px;color:#e2e8f0;font-size:13px;line-height:1.5;">
                ${formattedText}
              </div>
            </div>
          `
          geminiCache.set(day, section)
          return section
        }
      } catch (geminiError) {
        console.error('Gemini API error:', geminiError)
      }
      geminiCache.set(day, '')
      return ''
    }

    // Build HTML email for a subscriber
    const buildHtml = (name: string, email: string, currentDay: number, words: Word[], geminiSection: string) => {
      const wordRows = words.map((w, i) => `
        <tr>
          <td style="padding:8px 6px;color:#a1a1aa;font-size:12px;border-bottom:1px solid #27272a;text-align:center;">${i + 1}</td>
          <td style="padding:8px;color:#f4f4f5;font-size:14px;font-weight:600;border-bottom:1px solid #27272a;">${w.word}</td>
          <td style="padding:8px;color:#a1a1aa;font-size:13px;border-bottom:1px solid #27272a;">${w.meaning}</td>
        </tr>
      `).join('')

      return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="x-apple-disable-message-reformatting"><meta http-equiv="X-UA-Compatible" content="IE=edge"></head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="max-width:480px;margin:0 auto;padding:16px 12px;">
    <!-- Header -->
    <div style="text-align:center;padding:12px 0;">
      <div style="font-size:32px;margin-bottom:4px;" role="img" aria-label="Panda mascot">🐼</div>
      <h1 style="color:#f4f4f5;font-size:18px;margin:0 0 2px;">옛설판다</h1>
      <p style="color:#71717a;font-size:12px;margin:0;">비즈니스 영어 마스터</p>
    </div>

    <!-- Day Badge -->
    <div style="text-align:center;margin-bottom:12px;">
      <span style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#d97706);color:#000;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:700;">
        🌅 Day ${currentDay} / ${totalDays}
      </span>
    </div>

    <!-- Greeting -->
    <div style="background:#18181b;border:1px solid #27272a;border-radius:10px;padding:12px 14px;margin-bottom:12px;">
      <p style="color:#f4f4f5;font-size:14px;margin:0 0 4px;">안녕하세요, <strong>${name}</strong>님!</p>
      <p style="color:#a1a1aa;font-size:13px;margin:0;line-height:1.4;">
        오늘의 비즈니스 영어 단어 <strong style="color:#f59e0b;">${words.length}개</strong>를 준비했습니다.
      </p>
    </div>

    <!-- Word Table -->
    <div style="background:#18181b;border:1px solid #27272a;border-radius:10px;overflow:hidden;margin-bottom:12px;">
      <div style="padding:10px 14px;border-bottom:1px solid #27272a;">
        <h2 style="color:#f4f4f5;font-size:14px;margin:0;">📚 오늘의 단어</h2>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        ${wordRows}
      </table>
    </div>

    <!-- Gemini Business Examples -->
    ${geminiSection}

    <!-- Tips -->
    <div style="background:#18181b;border:1px solid #27272a;border-radius:10px;padding:12px 14px;margin-bottom:12px;">
      <h3 style="color:#f4f4f5;font-size:13px;margin:0 0 6px;">💡 학습 팁</h3>
      <ul style="color:#a1a1aa;font-size:12px;margin:0;padding-left:16px;line-height:1.6;">
        <li>단어를 3번씩 소리 내어 읽어보세요</li>
        <li>잠시 후 점심 테스트가 발송됩니다</li>
      </ul>
    </div>

    <!-- Action Buttons -->
    <div style="text-align:center;margin:12px 0;">
      <a href="${dashboardUrl}/login" style="display:inline-block;background:#8B5CF6;color:#fff;text-decoration:none;padding:10px 28px;border-radius:8px;font-size:13px;font-weight:600;margin-right:8px;margin-bottom:8px;border:2px solid #8B5CF6;">
        📊 내 학습 관리
      </a>
      <a href="${dashboardUrl}/postpone?email=${encodeURIComponent(email)}&day=${currentDay}" style="display:inline-block;background:#ec4899;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;border:2px solid #ec4899;">
        ⏰ 내일로 미루기
      </a>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:8px 0;">
      <p style="color:#52525b;font-size:11px;margin:0;">옛설판다 · 매일 성장하는 비즈니스 영어</p>
    </div>
  </div>
</body>
</html>`
    }

    // Send emails to each eligible subscriber
    const results: { email: string; day: number; status: number; id: string | null }[] = []
    const skippedNoWords: string[] = []

    for (const [day, subs] of subscribersByDay) {
      const words = wordsByDay.get(day) || []

      if (words.length === 0) {
        subs.forEach(s => skippedNoWords.push(s.email))
        continue
      }

      // Generate Gemini section for this day (cached)
      const geminiSection = await generateGeminiSection(words, day)

      for (const sub of subs) {
        const html = buildHtml(sub.name || '학습자', sub.email, day, words, geminiSection)

        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `옛설판다 <${emailFrom}>`,
            to: [sub.email],
            subject: `🌅 Day ${day} - 오늘의 비즈니스 영어 (${words.length}개)`,
            html,
          }),
        })

        const resBody = await res.json()
        results.push({ email: sub.email, day, status: res.status, id: resBody.id || null })
      }
    }

    return new Response(JSON.stringify({
      success: true,
      totalSubscribers: subscribers.length,
      eligibleToday: eligibleSubscribers.length,
      sent: results.length,
      skippedNoWords,
      results
    }), {
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
