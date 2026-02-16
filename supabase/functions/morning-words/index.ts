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

    // Get today's day of week in Korea timezone (0=Sun, 1=Mon, ..., 6=Sat)
    const koreaTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
    const todayDayOfWeek = koreaTime.getDay()

    // Get active subscribers with their personal current_day
    const { data: subscribers, error: subError } = await supabase
      .from('subscribers')
      .select('email, name, current_day, active_days')
      .eq('status', 'active')

    if (subError) throw new Error(`DB error: ${subError.message}`)
    if (!subscribers || subscribers.length === 0) {
      return new Response(JSON.stringify({ error: 'No active subscribers' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    // Get current time in Korea timezone (HH:MM format)
    const currentHour = koreaTime.getHours().toString().padStart(2, '0')
    const currentMinute = koreaTime.getMinutes().toString().padStart(2, '0')
    const currentTimeStr = `${currentHour}:${currentMinute}`

    // Get notification settings for each subscriber (all channels + morning_time)
    const { data: settingsData } = await supabase
      .from('subscriber_settings')
      .select('email, email_enabled, telegram_enabled, telegram_chat_id, google_chat_enabled, google_chat_webhook, morning_time')

    interface SubscriberSettings {
      email_enabled: boolean
      telegram_enabled: boolean
      telegram_chat_id: string | null
      google_chat_enabled: boolean
      google_chat_webhook: string | null
      morning_time: string
    }
    const settingsMap = new Map<string, SubscriberSettings>()
    settingsData?.forEach((s: {
      email: string;
      email_enabled: boolean | null;
      telegram_enabled: boolean | null;
      telegram_chat_id: string | null;
      google_chat_enabled: boolean | null;
      google_chat_webhook: string | null;
      morning_time: string | null;
    }) => {
      settingsMap.set(s.email, {
        email_enabled: s.email_enabled !== false,
        telegram_enabled: s.telegram_enabled === true,
        telegram_chat_id: s.telegram_chat_id,
        google_chat_enabled: s.google_chat_enabled === true,
        google_chat_webhook: s.google_chat_webhook,
        morning_time: s.morning_time || '07:30',
      })
    })

    // Helper to check if current time is within tolerance of target time
    // Reduced to 3 minutes to prevent duplicate sends from multiple cron runs
    const isTimeMatch = (targetTime: string, toleranceMinutes: number = 3) => {
      const [targetHour, targetMinute] = targetTime.split(':').map(Number)
      const targetTotal = targetHour * 60 + targetMinute
      const currentTotal = parseInt(currentHour) * 60 + parseInt(currentMinute)
      const diff = Math.abs(currentTotal - targetTotal)
      return diff <= toleranceMinutes || diff >= (24 * 60 - toleranceMinutes) // Handle midnight wrap
    }

    // Filter subscribers by active days AND matching time (any channel enabled)
    const eligibleSubscribers = (subscribers as Subscriber[]).filter(sub => {
      const settings = settingsMap.get(sub.email) || { email_enabled: true, telegram_enabled: false, google_chat_enabled: false, telegram_chat_id: null, google_chat_webhook: null, morning_time: '07:30' }
      const hasAnyChannel = settings.email_enabled || settings.telegram_enabled || settings.google_chat_enabled
      const activeDays = sub.active_days || [1, 2, 3, 4, 5] // Default: Mon-Fri
      const isTodayActive = activeDays.includes(todayDayOfWeek)
      const isRightTime = isTimeMatch(settings.morning_time)
      return hasAnyChannel && isTodayActive && isRightTime
    })

    // Telegram Bot token
    const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN')

    // Send Telegram message with inline buttons
    const sendTelegram = async (chatId: string, text: string, buttons?: { text: string; url: string }[]) => {
      if (!telegramBotToken || !chatId) return false
      try {
        const body: Record<string, unknown> = {
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
        }
        if (buttons && buttons.length > 0) {
          body.reply_markup = {
            inline_keyboard: [buttons.map(b => ({ text: b.text, url: b.url }))]
          }
        }
        const res = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        return res.ok
      } catch (e) {
        console.error('Telegram error:', e)
        return false
      }
    }

    // Send Google Chat message with card buttons
    const sendGoogleChat = async (webhookUrl: string, text: string, buttons?: { text: string; url: string }[]) => {
      if (!webhookUrl) return false
      try {
        let body: Record<string, unknown>
        if (buttons && buttons.length > 0) {
          // Use card format for buttons
          body = {
            cardsV2: [{
              cardId: 'morning-words',
              card: {
                header: {
                  title: '🦝 옛설판다',
                  subtitle: '비즈니스 영어 학습'
                },
                sections: [{
                  widgets: [
                    { textParagraph: { text } },
                    {
                      buttonList: {
                        buttons: buttons.map(b => ({
                          text: b.text,
                          onClick: { openLink: { url: b.url } }
                        }))
                      }
                    }
                  ]
                }]
              }
            }]
          }
        } else {
          body = { text }
        }
        const res = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        return res.ok
      } catch (e) {
        console.error('Google Chat error:', e)
        return false
      }
    }

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
      <div style="font-size:32px;margin-bottom:4px;" role="img" aria-label="Red panda mascot">🦝</div>
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

    // Get today's date in Korea timezone
    const todayDate = koreaTime.toISOString().slice(0, 10)

    // Check who already received morning-words today (deduplication)
    const { data: alreadySent } = await supabase
      .from('attendance')
      .select('email')
      .eq('date', todayDate)
      .eq('type', 'morning_words')

    const alreadySentEmails = new Set(alreadySent?.map(r => r.email) || [])

    // Send notifications to each eligible subscriber
    const results: { email: string; day: number; email_sent: boolean; telegram_sent: boolean; gchat_sent: boolean }[] = []
    const skippedNoWords: string[] = []
    const skippedAlreadySent: string[] = []

    for (const [day, subs] of subscribersByDay) {
      const words = wordsByDay.get(day) || []

      if (words.length === 0) {
        subs.forEach(s => skippedNoWords.push(s.email))
        continue
      }

      // Generate Gemini section for this day (cached) - for email
      const geminiSection = await generateGeminiSection(words, day)

      // Build plain text for Telegram/Google Chat
      const wordListText = words.map((w, i) => `${i + 1}. ${w.word} - ${w.meaning}`).join('\n')
      const telegramText = (name: string, currentDay: number) =>
        `🌅 <b>Day ${currentDay} - 오늘의 비즈니스 영어</b>\n\n` +
        `안녕하세요, ${name}님!\n` +
        `오늘의 단어 ${words.length}개입니다.\n\n` +
        `📚 <b>오늘의 단어:</b>\n` +
        wordListText + `\n\n` +
        `💡 잠시 후 점심 테스트가 발송됩니다!\n\n` +
        `📊 대시보드: ${dashboardUrl}/login`

      const googleChatText = (name: string, currentDay: number) =>
        `🌅 *Day ${currentDay} - 오늘의 비즈니스 영어*\n\n` +
        `안녕하세요, ${name}님!\n` +
        `오늘의 단어 ${words.length}개입니다.\n\n` +
        `📚 *오늘의 단어:*\n` +
        wordListText + `\n\n` +
        `💡 잠시 후 점심 테스트가 발송됩니다!`

      for (const sub of subs) {
        // Skip if already sent today (deduplication)
        if (alreadySentEmails.has(sub.email)) {
          skippedAlreadySent.push(sub.email)
          continue
        }

        const settings = settingsMap.get(sub.email) || { email_enabled: true, telegram_enabled: false, google_chat_enabled: false, telegram_chat_id: null, google_chat_webhook: null }
        const name = sub.name || '학습자'

        let emailSent = false
        let telegramSent = false
        let gchatSent = false

        // Send Email
        if (settings.email_enabled) {
          const html = buildHtml(name, sub.email, day, words, geminiSection)
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
          emailSent = res.ok
        }

        // Build action buttons
        const actionButtons = [
          { text: '📊 학습 관리', url: `${dashboardUrl}/login` },
          { text: '⏰ 내일로 미루기', url: `${dashboardUrl}/postpone?email=${encodeURIComponent(sub.email)}&day=${day}` }
        ]

        // Send Telegram
        if (settings.telegram_enabled && settings.telegram_chat_id) {
          telegramSent = await sendTelegram(settings.telegram_chat_id, telegramText(name, day), actionButtons)
        }

        // Send Google Chat
        if (settings.google_chat_enabled && settings.google_chat_webhook) {
          gchatSent = await sendGoogleChat(settings.google_chat_webhook, googleChatText(name, day), actionButtons)
        }

        // Record that we sent morning-words to prevent duplicate sends
        await supabase.from('attendance').upsert(
          { email: sub.email, date: todayDate, type: 'morning_words', completed: true },
          { onConflict: 'email,date,type' }
        )

        results.push({ email: sub.email, day, email_sent: emailSent, telegram_sent: telegramSent, gchat_sent: gchatSent })
      }
    }

    return new Response(JSON.stringify({
      success: true,
      totalSubscribers: subscribers.length,
      eligibleToday: eligibleSubscribers.length,
      sent: results.length,
      skippedNoWords,
      skippedAlreadySent,
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
