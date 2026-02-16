import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BASE = 'https://dashboard-keprojects.vercel.app'

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

    // Get today's day of week in Korea timezone (0=Sun, 1=Mon, ..., 6=Sat)
    const koreaTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
    const todayDayOfWeek = koreaTime.getDay()

    // Get current time in Korea timezone (HH:MM format)
    const currentHour = koreaTime.getHours().toString().padStart(2, '0')
    const currentMinute = koreaTime.getMinutes().toString().padStart(2, '0')

    // Get active subscribers with their personal current_day
    const { data: subscribers, error: subError } = await supabase
      .from('subscribers')
      .select('email, name, current_day, active_days')
      .eq('status', 'active')

    if (subError) throw new Error(`DB error: ${subError.message}`)
    if (!subscribers || subscribers.length === 0) {
      return new Response(JSON.stringify({ error: 'No active subscribers' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404,
      })
    }

    // Helper to check if current time is within tolerance of target time
    // Reduced to 3 minutes to prevent duplicate sends from multiple cron runs
    const isTimeMatch = (targetTime: string, toleranceMinutes: number = 3) => {
      const [targetHour, targetMinute] = targetTime.split(':').map(Number)
      const targetTotal = targetHour * 60 + targetMinute
      const currentTotal = parseInt(currentHour) * 60 + parseInt(currentMinute)
      const diff = Math.abs(currentTotal - targetTotal)
      return diff <= toleranceMinutes || diff >= (24 * 60 - toleranceMinutes)
    }

    // Get notification settings (all channels)
    const { data: settingsData } = await supabase
      .from('subscriber_settings')
      .select('email, email_enabled, telegram_enabled, telegram_chat_id, google_chat_enabled, google_chat_webhook, lunch_time')

    interface SubscriberSettings {
      email_enabled: boolean
      telegram_enabled: boolean
      telegram_chat_id: string | null
      google_chat_enabled: boolean
      google_chat_webhook: string | null
      lunch_time: string
    }
    const settingsMap = new Map<string, SubscriberSettings>()
    settingsData?.forEach((s: {
      email: string
      email_enabled: boolean | null
      telegram_enabled: boolean | null
      telegram_chat_id: string | null
      google_chat_enabled: boolean | null
      google_chat_webhook: string | null
      lunch_time: string | null
    }) => {
      settingsMap.set(s.email, {
        email_enabled: s.email_enabled !== false,
        telegram_enabled: s.telegram_enabled === true,
        telegram_chat_id: s.telegram_chat_id,
        google_chat_enabled: s.google_chat_enabled === true,
        google_chat_webhook: s.google_chat_webhook,
        lunch_time: s.lunch_time || '12:00',
      })
    })

    // Filter eligible subscribers (any channel enabled + right day + right time)
    const eligibleSubscribers = (subscribers as Subscriber[]).filter(sub => {
      const settings = settingsMap.get(sub.email) || { email_enabled: true, telegram_enabled: false, google_chat_enabled: false, telegram_chat_id: null, google_chat_webhook: null, lunch_time: '12:00' }
      const hasAnyChannel = settings.email_enabled || settings.telegram_enabled || settings.google_chat_enabled
      const activeDays = sub.active_days || [1, 2, 3, 4, 5]
      const isTodayActive = activeDays.includes(todayDayOfWeek)
      const isRightTime = isTimeMatch(settings.lunch_time)
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
          body = {
            cardsV2: [{
              cardId: 'lunch-test',
              card: {
                header: {
                  title: '🦝 옛설판다',
                  subtitle: '점심 테스트'
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
        message: 'No eligible subscribers for today'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get today's date for deduplication
    const todayDate = koreaTime.toISOString().slice(0, 10)

    // Check who already received lunch-test today (deduplication)
    const { data: alreadySent } = await supabase
      .from('attendance')
      .select('email')
      .eq('date', todayDate)
      .eq('type', 'lunch_test')

    const alreadySentEmails = new Set(alreadySent?.map(r => r.email) || [])
    const skippedAlreadySent: string[] = []

    // Group subscribers by their current_day
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

    const buildHtml = (name: string, email: string, currentDay: number, words: Word[]) => {
      const e = encodeURIComponent(email)
      const completeLink = `${BASE}/api/complete?email=${e}&day=${currentDay}`
      const shuffled = shuffleArray(words)

      const rows = shuffled.map((w, i) => {
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
<span style="font-size:24px;">🦝</span>
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
<a href="${BASE}/login" style="display:inline-block;background:#8B5CF6;color:#fff;text-decoration:none;padding:8px 20px;border-radius:8px;font-size:12px;font-weight:600;margin-right:8px;">📊 내 학습 관리</a>
<a href="${BASE}/postpone?email=${e}&day=${currentDay}" style="display:inline-block;background:#ec4899;color:#fff;text-decoration:none;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:600;">⏰ 내일로 미루기</a>
</div>
<p style="text-align:center;color:#3f3f46;font-size:9px;margin:6px 0 0;">옛설판다 · 비즈니스 영어</p>
</div>
</body></html>`
    }

    const results: { email: string; day: number; email_sent: boolean; telegram_sent: boolean; gchat_sent: boolean }[] = []
    const skippedNoWords: string[] = []

    for (const [day, subs] of subscribersByDay) {
      const words = wordsByDay.get(day) || []

      if (words.length === 0) {
        subs.forEach(s => skippedNoWords.push(s.email))
        continue
      }

      // Build text for Telegram/Google Chat
      const wordListText = shuffleArray(words).map((w, i) => `${i + 1}. ${w.word} - ???`).join('\n')
      const telegramText = (name: string, currentDay: number, email: string) =>
        `🍽️ <b>Day ${currentDay} 점심 테스트</b>\n\n` +
        `${name}님, 뜻을 떠올려보세요!\n\n` +
        `📝 <b>오늘의 단어:</b>\n` + wordListText + `\n\n` +
        `✏️ 테스트 하기: ${BASE}/quiz?day=${currentDay}&email=${encodeURIComponent(email)}`

      const googleChatText = (name: string, currentDay: number, email: string) =>
        `🍽️ *Day ${currentDay} 점심 테스트*\n\n` +
        `${name}님, 뜻을 떠올려보세요!\n\n` +
        `📝 *오늘의 단어:*\n` + wordListText + `\n\n` +
        `✏️ 테스트 하기: ${BASE}/quiz?day=${currentDay}&email=${encodeURIComponent(email)}`

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
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: '옛설판다 <onboarding@resend.dev>',
              to: [sub.email],
              subject: `🍽️ Day ${day} 점심 테스트`,
              html: buildHtml(name, sub.email, day, words),
            }),
          })
          emailSent = res.ok
        }

        // Build action buttons for lunch test
        const actionButtons = [
          { text: '✅ 학습 완료', url: `${BASE}/api/complete?email=${encodeURIComponent(sub.email)}&day=${day}` },
          { text: '📊 학습 관리', url: `${BASE}/login` },
          { text: '⏰ 내일로 미루기', url: `${BASE}/postpone?email=${encodeURIComponent(sub.email)}&day=${day}` }
        ]

        // Send Telegram
        if (settings.telegram_enabled && settings.telegram_chat_id) {
          telegramSent = await sendTelegram(settings.telegram_chat_id, telegramText(name, day, sub.email), actionButtons)
        }

        // Send Google Chat
        if (settings.google_chat_enabled && settings.google_chat_webhook) {
          gchatSent = await sendGoogleChat(settings.google_chat_webhook, googleChatText(name, day, sub.email), actionButtons)
        }

        // Record that we sent lunch-test to prevent duplicate sends
        await supabase.from('attendance').upsert(
          { email: sub.email, date: todayDate, type: 'lunch_test', completed: true },
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
    console.error('lunch-test error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    })
  }
})
