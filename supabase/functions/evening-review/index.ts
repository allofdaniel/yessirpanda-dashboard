import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DASHBOARD_URL = 'https://dashboard-keprojects.vercel.app'

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

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get config for total days
    const { data: configData } = await supabase.from('config').select('key, value')
    const config: Record<string, string> = {}
    configData?.forEach((r: { key: string; value: string }) => { config[r.key] = r.value })
    const totalDays = parseInt(config.TotalDays || '90')

    // Get today's day of week in Korea timezone (0=Sun, 1=Mon, ..., 6=Sat)
    const koreaTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
    const todayDayOfWeek = koreaTime.getDay()
    const today = koreaTime.toISOString().slice(0, 10)

    // Get active subscribers with their personal current_day and active_days
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

    // Get notification settings (all channels)
    const { data: settingsData } = await supabase
      .from('subscriber_settings')
      .select('email, email_enabled, telegram_enabled, telegram_chat_id, google_chat_enabled, google_chat_webhook')

    interface SubscriberSettings {
      email_enabled: boolean
      telegram_enabled: boolean
      telegram_chat_id: string | null
      google_chat_enabled: boolean
      google_chat_webhook: string | null
    }
    const settingsMap = new Map<string, SubscriberSettings>()
    settingsData?.forEach((s: {
      email: string
      email_enabled: boolean | null
      telegram_enabled: boolean | null
      telegram_chat_id: string | null
      google_chat_enabled: boolean | null
      google_chat_webhook: string | null
    }) => {
      settingsMap.set(s.email, {
        email_enabled: s.email_enabled !== false,
        telegram_enabled: s.telegram_enabled === true,
        telegram_chat_id: s.telegram_chat_id,
        google_chat_enabled: s.google_chat_enabled === true,
        google_chat_webhook: s.google_chat_webhook,
      })
    })

    // Filter eligible subscribers (any channel enabled)
    const eligibleSubscribers = (subscribers as Subscriber[]).filter(sub => {
      const settings = settingsMap.get(sub.email) || { email_enabled: true, telegram_enabled: false, google_chat_enabled: false, telegram_chat_id: null, google_chat_webhook: null }
      const hasAnyChannel = settings.email_enabled || settings.telegram_enabled || settings.google_chat_enabled
      const activeDays = sub.active_days || [1, 2, 3, 4, 5]
      const isTodayActive = activeDays.includes(todayDayOfWeek)
      return hasAnyChannel && isTodayActive
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
              cardId: 'evening-review',
              card: {
                header: {
                  title: '🐼 옛설판다',
                  subtitle: '저녁 복습'
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

    // Cache for Gemini responses by day
    const geminiCache = new Map<number, string>()

    // Generate Gemini review materials
    const generateGeminiSection = async (words: Word[], day: number): Promise<string> => {
      if (geminiCache.has(day)) {
        return geminiCache.get(day)!
      }

      try {
        const wordList = words.map((w, i) => `${i + 1}. ${w.word} (${w.meaning})`).join('\n')
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
            .replace(/\[(.+?)\]/g, '<h3 style="color:#a78bfa;font-size:13px;margin:10px 0 6px;">$1</h3>')
            .replace(/\n- /g, '<br>• ')
            .replace(/\n\n/g, '<div style="height:6px;"></div>')
            .replace(/\n/g, '<br>')

          const section = `
            <div style="background:#18181b;border:1px solid #8b5cf640;border-radius:10px;overflow:hidden;margin-bottom:12px;">
              <div style="padding:10px 14px;border-bottom:1px solid #27272a;background:linear-gradient(135deg,#8b5cf620,#7c3aed20);">
                <h2 style="color:#a78bfa;font-size:14px;margin:0;">🤖 AI 복습 자료</h2>
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

    const results: {
      email: string
      day: number
      email_sent: boolean
      telegram_sent: boolean
      gchat_sent: boolean
      completedLunch: boolean
      wrongCount: number
      dayAdvanced: boolean
    }[] = []

    for (const [currentDay, subs] of subscribersByDay) {
      const words = wordsByDay.get(currentDay) || []
      if (words.length === 0) continue

      const geminiSection = await generateGeminiSection(words, currentDay)

      for (const sub of subs) {
        // Check if this subscriber clicked "학습 완료" today
        const { data: lunchAttendance } = await supabase
          .from('attendance')
          .select('id')
          .eq('email', sub.email)
          .eq('type', 'lunch')
          .eq('date', today)
          .limit(1)

        const completedLunch = lunchAttendance && lunchAttendance.length > 0

        // Get wrong words for this subscriber
        const { data: wrongWords } = await supabase
          .from('wrong_words')
          .select('word, meaning, wrong_count')
          .eq('email', sub.email)
          .eq('mastered', false)
          .order('wrong_count', { ascending: false })
          .limit(20)

        // Build quiz status section
        let quizStatusSection = ''
        if (completedLunch) {
          quizStatusSection = `
            <div style="background:#18181b;border:1px solid #065f46;border-radius:10px;padding:14px;margin-bottom:12px;text-align:center;">
              <div style="font-size:24px;margin-bottom:4px;">✅</div>
              <p style="color:#10b981;font-size:14px;font-weight:600;margin:0;">오늘 학습 완료!</p>
            </div>
          `
        } else {
          const completeLink = `${DASHBOARD_URL}/api/complete?email=${encodeURIComponent(sub.email)}&day=${currentDay}`
          quizStatusSection = `
            <div style="background:#18181b;border:1px solid #f59e0b;border-radius:10px;padding:14px;margin-bottom:12px;text-align:center;">
              <div style="font-size:24px;margin-bottom:4px;">⚠️</div>
              <p style="color:#f59e0b;font-size:14px;font-weight:600;margin:0 0 4px;">아직 학습 완료를 안 하셨어요!</p>
              <p style="color:#a1a1aa;font-size:12px;margin:0 0 8px;">완료 버튼을 눌러야 다음 Day로 진행됩니다</p>
              <a href="${completeLink}" style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#d97706);color:#000;text-decoration:none;padding:8px 24px;border-radius:8px;font-size:13px;font-weight:700;">
                학습 완료하기
              </a>
            </div>
          `
        }

        // Build wrong words section
        let wrongSection = ''
        if (wrongWords && wrongWords.length > 0) {
          const wrongRows = wrongWords.map((w: { word: string; meaning: string; wrong_count: number }, i: number) => `
            <tr>
              <td style="padding:6px;color:#a1a1aa;font-size:12px;border-bottom:1px solid #27272a;text-align:center;">${i + 1}</td>
              <td style="padding:6px 8px;color:#f87171;font-size:13px;font-weight:600;border-bottom:1px solid #27272a;">${w.word}</td>
              <td style="padding:6px 8px;color:#a1a1aa;font-size:12px;border-bottom:1px solid #27272a;">${w.meaning}</td>
              <td style="padding:6px;color:#f59e0b;font-size:11px;border-bottom:1px solid #27272a;text-align:center;">${w.wrong_count}회</td>
            </tr>
          `).join('')

          wrongSection = `
            <div style="background:#18181b;border:1px solid #dc2626;border-radius:10px;overflow:hidden;margin-bottom:12px;">
              <div style="padding:10px 14px;border-bottom:1px solid #27272a;background:#7f1d1d20;">
                <h2 style="color:#f87171;font-size:14px;margin:0;">❌ 오답 노트 (${wrongWords.length}개)</h2>
              </div>
              <table style="width:100%;border-collapse:collapse;">
                ${wrongRows}
              </table>
            </div>
          `
        } else {
          wrongSection = `
            <div style="background:#18181b;border:1px solid #27272a;border-radius:10px;padding:14px;margin-bottom:12px;text-align:center;">
              <div style="font-size:24px;margin-bottom:4px;">🎉</div>
              <p style="color:#10b981;font-size:14px;font-weight:600;margin:0 0 2px;">오답이 없습니다!</p>
              <p style="color:#71717a;font-size:12px;margin:0;">모든 단어를 완벽하게 학습하셨네요</p>
            </div>
          `
        }

        // Build today's words review
        const wordRows = words.map((w, i) => `
          <tr>
            <td style="padding:6px;color:#a1a1aa;font-size:12px;border-bottom:1px solid #27272a;text-align:center;">${i + 1}</td>
            <td style="padding:6px 8px;color:#f4f4f5;font-size:13px;font-weight:600;border-bottom:1px solid #27272a;">${w.word}</td>
            <td style="padding:6px 8px;color:#a1a1aa;font-size:12px;border-bottom:1px solid #27272a;">${w.meaning}</td>
          </tr>
        `).join('')

        // Calculate progress
        const progressPercent = Math.round((currentDay / totalDays) * 100)
        const nextDay = currentDay + 1

        const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:16px 12px;">
    <!-- Header -->
    <div style="text-align:center;padding:12px 0;">
      <div style="font-size:32px;margin-bottom:4px;">🐼</div>
      <h1 style="color:#f4f4f5;font-size:18px;margin:0 0 2px;">옛설판다</h1>
      <p style="color:#71717a;font-size:12px;margin:0;">비즈니스 영어 마스터</p>
    </div>

    <!-- Day Badge -->
    <div style="text-align:center;margin-bottom:12px;">
      <span style="display:inline-block;background:linear-gradient(135deg,#8b5cf6,#7c3aed);color:#fff;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:700;">
        🌙 Day ${currentDay} 저녁 복습
      </span>
    </div>

    <!-- Greeting -->
    <div style="background:#18181b;border:1px solid #27272a;border-radius:10px;padding:12px 14px;margin-bottom:12px;">
      <p style="color:#f4f4f5;font-size:14px;margin:0 0 4px;">${sub.name || '학습자'}님, 수고하셨습니다! 🎊</p>
      <p style="color:#a1a1aa;font-size:13px;margin:0;line-height:1.4;">
        Day ${currentDay} 저녁 복습입니다. 오늘 배운 내용을 정리해보세요.
      </p>
    </div>

    <!-- Quiz Status -->
    ${quizStatusSection}

    <!-- Wrong Words Section -->
    ${wrongSection}

    <!-- Today's Full Review -->
    <div style="background:#18181b;border:1px solid #27272a;border-radius:10px;overflow:hidden;margin-bottom:12px;">
      <div style="padding:10px 14px;border-bottom:1px solid #27272a;">
        <h2 style="color:#f4f4f5;font-size:14px;margin:0;">📖 오늘의 전체 단어</h2>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        ${wordRows}
      </table>
    </div>

    <!-- Gemini Review Materials -->
    ${geminiSection}

    <!-- Progress Bar -->
    <div style="background:#18181b;border:1px solid #27272a;border-radius:10px;padding:14px;margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <span style="color:#f4f4f5;font-size:13px;font-weight:600;">📊 전체 진도</span>
        <span style="color:#8b5cf6;font-size:13px;font-weight:700;">${progressPercent}%</span>
      </div>
      <div style="background:#27272a;border-radius:6px;height:6px;overflow:hidden;">
        <div style="background:linear-gradient(90deg,#8b5cf6,#a78bfa);height:100%;width:${progressPercent}%;border-radius:6px;"></div>
      </div>
      <p style="color:#71717a;font-size:11px;margin:4px 0 0;text-align:center;">
        Day ${currentDay} / ${totalDays}
      </p>
    </div>

    <!-- Tomorrow Preview -->
    ${nextDay <= totalDays ? `
    <div style="background:#18181b;border:1px solid #27272a;border-radius:10px;padding:14px;text-align:center;">
      <p style="color:#f4f4f5;font-size:13px;margin:0 0 2px;">내일은 <strong style="color:#f59e0b;">Day ${nextDay}</strong>입니다</p>
      <p style="color:#71717a;font-size:12px;margin:0;">내일 아침에 만나요! 🌅</p>
    </div>
    ` : `
    <div style="background:#18181b;border:1px solid #f59e0b;border-radius:10px;padding:14px;text-align:center;">
      <div style="font-size:24px;margin-bottom:4px;">🏆</div>
      <p style="color:#f59e0b;font-size:15px;font-weight:700;margin:0 0 2px;">축하합니다!</p>
      <p style="color:#a1a1aa;font-size:12px;margin:0;">모든 학습 과정을 완료하셨습니다!</p>
    </div>
    `}

    <!-- Dashboard Link -->
    <div style="text-align:center;margin:12px 0;">
      <a href="${DASHBOARD_URL}/login" style="display:inline-block;background:#8B5CF6;color:#fff;text-decoration:none;padding:10px 28px;border-radius:8px;font-size:13px;font-weight:600;">📊 내 학습 관리</a>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:8px 0;">
      <p style="color:#52525b;font-size:11px;margin:0;">옛설판다 · 매일 성장하는 비즈니스 영어</p>
    </div>
  </div>
</body>
</html>`

        const settings = settingsMap.get(sub.email) || { email_enabled: true, telegram_enabled: false, google_chat_enabled: false, telegram_chat_id: null, google_chat_webhook: null }
        const name = sub.name || '학습자'

        let emailSent = false
        let telegramSent = false
        let gchatSent = false

        // Build text for Telegram/Google Chat
        const wrongCount = wrongWords?.length || 0
        const telegramText =
          `🌙 <b>Day ${currentDay} 저녁 복습</b>\n\n` +
          `${name}님, 오늘 수고하셨습니다!\n\n` +
          `📊 <b>오늘의 결과:</b>\n` +
          (completedLunch ? `✅ 학습 완료\n` : `⚠️ 학습 미완료\n`) +
          (wrongCount > 0 ? `❌ 복습 필요 단어: ${wrongCount}개\n\n` : `🎉 오답 없음!\n\n`) +
          `📚 전체 진도: Day ${currentDay}/${totalDays} (${Math.round((currentDay / totalDays) * 100)}%)\n\n` +
          `📊 자세히 보기: ${DASHBOARD_URL}/stats`

        const googleChatText =
          `🌙 *Day ${currentDay} 저녁 복습*\n\n` +
          `${name}님, 오늘 수고하셨습니다!\n\n` +
          `📊 *오늘의 결과:*\n` +
          (completedLunch ? `✅ 학습 완료\n` : `⚠️ 학습 미완료\n`) +
          (wrongCount > 0 ? `❌ 복습 필요 단어: ${wrongCount}개\n\n` : `🎉 오답 없음!\n\n`) +
          `📚 전체 진도: Day ${currentDay}/${totalDays}`

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
              subject: `🌙 Day ${currentDay} 저녁 복습 - 오늘의 학습 정리`,
              html,
            }),
          })
          emailSent = res.ok
        }

        // Build action buttons for evening review
        const actionButtons = completedLunch
          ? [
              { text: '📊 학습 관리', url: `${DASHBOARD_URL}/login` }
            ]
          : [
              { text: '✅ 학습 완료', url: `${DASHBOARD_URL}/api/complete?email=${encodeURIComponent(sub.email)}&day=${currentDay}` },
              { text: '📊 학습 관리', url: `${DASHBOARD_URL}/login` }
            ]

        // Send Telegram
        if (settings.telegram_enabled && settings.telegram_chat_id) {
          telegramSent = await sendTelegram(settings.telegram_chat_id, telegramText, actionButtons)
        }

        // Send Google Chat
        if (settings.google_chat_enabled && settings.google_chat_webhook) {
          gchatSent = await sendGoogleChat(settings.google_chat_webhook, googleChatText, actionButtons)
        }

        // Record attendance
        await supabase.from('attendance').upsert(
          { email: sub.email, date: today, type: 'evening', completed: true },
          { onConflict: 'email,date,type' }
        )

        // Advance this individual subscriber's day if they completed lunch
        let dayAdvanced = false
        if (completedLunch && nextDay <= totalDays) {
          await supabase
            .from('subscribers')
            .update({
              current_day: nextDay,
              last_lesson_at: new Date().toISOString()
            })
            .eq('email', sub.email)
          dayAdvanced = true
        }

        results.push({
          email: sub.email,
          day: currentDay,
          email_sent: emailSent,
          telegram_sent: telegramSent,
          gchat_sent: gchatSent,
          completedLunch,
          wrongCount: wrongWords?.length || 0,
          dayAdvanced,
        })
      }
    }

    return new Response(JSON.stringify({
      success: true,
      totalSubscribers: subscribers.length,
      eligibleToday: eligibleSubscribers.length,
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
