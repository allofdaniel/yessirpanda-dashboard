import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase'

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const DASHBOARD_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://dashboard-keprojects.vercel.app'

interface TelegramUpdate {
  update_id: number
  message?: {
    message_id: number
    from: {
      id: number
      is_bot: boolean
      first_name: string
      last_name?: string
      username?: string
    }
    chat: {
      id: number
      type: string
    }
    date: number
    text?: string
  }
}

// Send message via Telegram Bot API
async function sendTelegramMessage(chatId: number, text: string, replyMarkup?: object) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`

  const body: { chat_id: number; text: string; parse_mode: string; reply_markup?: object } = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
  }

  if (replyMarkup) {
    body.reply_markup = replyMarkup
  }

  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// Telegram webhook handler
export async function POST(request: NextRequest) {
  try {
    const update: TelegramUpdate = await request.json()

    if (!update.message?.text) {
      return NextResponse.json({ ok: true })
    }

    const chatId = update.message.chat.id
    const text = update.message.text.trim()
    const firstName = update.message.from.first_name
    const username = update.message.from.username

    const supabase = getServerClient()

    // Check if user is already linked
    const { data: existingLink } = await supabase
      .from('subscriber_settings')
      .select('email')
      .eq('telegram_chat_id', String(chatId))
      .single()

    // Handle /start command
    if (text === '/start') {
      if (existingLink?.email) {
        await sendTelegramMessage(chatId,
          `🦝 <b>옛설판다에 다시 오신 것을 환영합니다!</b>\n\n` +
          `${firstName}님, 이미 연결되어 있습니다.\n` +
          `연결된 이메일: ${existingLink.email}\n\n` +
          `아래 명령어를 사용해보세요:\n` +
          `/words - 오늘의 단어\n` +
          `/test - 단어 테스트\n` +
          `/stats - 내 통계\n` +
          `/help - 도움말`
        )
      } else {
        await sendTelegramMessage(chatId,
          `🦝 <b>옛설판다에 오신 것을 환영합니다!</b>\n\n` +
          `${firstName}님, 텔레그램으로 매일 비즈니스 영어를 학습할 수 있어요.\n\n` +
          `먼저 옛설판다 계정과 연결해주세요.\n` +
          `<b>등록된 이메일 주소를 입력해주세요:</b>\n\n` +
          `예시: example@email.com`
        )
      }
      return NextResponse.json({ ok: true })
    }

    // Handle /help command
    if (text === '/help' || text === '도움말') {
      await sendTelegramMessage(chatId,
        `🦝 <b>옛설판다 도움말</b>\n\n` +
        `${existingLink?.email ? `✅ 연결됨: ${existingLink.email}` : '❌ 미연결'}\n\n` +
        `<b>사용 가능한 명령어:</b>\n` +
        `/start - 시작하기\n` +
        `/words - 오늘의 단어 보기\n` +
        `/test - 단어 테스트\n` +
        `/review - 복습 (오답 노트)\n` +
        `/stats - 내 학습 통계\n` +
        `/change - 이메일 변경\n` +
        `/unlink - 연결 해제\n\n` +
        `<b>웹 대시보드:</b>\n` +
        `${DASHBOARD_URL}`
      )
      return NextResponse.json({ ok: true })
    }

    // Handle /unlink command
    if (text === '/unlink') {
      if (existingLink?.email) {
        await supabase
          .from('subscriber_settings')
          .update({ telegram_chat_id: null, telegram_enabled: false })
          .eq('telegram_chat_id', String(chatId))

        await sendTelegramMessage(chatId,
          `✅ 연결이 해제되었습니다.\n\n` +
          `다시 연결하려면 /start 를 입력해주세요.`
        )
      } else {
        await sendTelegramMessage(chatId, `연결된 계정이 없습니다.`)
      }
      return NextResponse.json({ ok: true })
    }

    // Handle /change command - allows changing the linked email
    if (text === '/change' || text === '이메일변경') {
      if (existingLink?.email) {
        // Disconnect current account first
        await supabase
          .from('subscriber_settings')
          .update({ telegram_chat_id: null, telegram_enabled: false })
          .eq('telegram_chat_id', String(chatId))

        await sendTelegramMessage(chatId,
          `🔄 <b>이메일 변경</b>\n\n` +
          `기존 연결(${existingLink.email})이 해제되었습니다.\n\n` +
          `새로 연결할 <b>이메일 주소를 입력해주세요:</b>\n\n` +
          `예시: example@email.com`
        )
      } else {
        await sendTelegramMessage(chatId,
          `연결된 계정이 없습니다.\n\n` +
          `<b>연결할 이메일 주소를 입력해주세요:</b>\n\n` +
          `예시: example@email.com`
        )
      }
      return NextResponse.json({ ok: true })
    }

    // If not linked, try to link with email
    if (!existingLink?.email) {
      // Check if input looks like an email
      if (text.includes('@') && text.includes('.')) {
        const email = text.toLowerCase().trim()

        // Check if subscriber exists
        const { data: subscriber } = await supabase
          .from('subscribers')
          .select('email, name')
          .eq('email', email)
          .single()

        if (!subscriber) {
          await sendTelegramMessage(chatId,
            `❌ "${email}" 이메일로 등록된 사용자를 찾을 수 없습니다.\n\n` +
            `옛설판다 웹사이트에서 먼저 가입해주세요:\n` +
            `${DASHBOARD_URL}/login`
          )
          return NextResponse.json({ ok: true })
        }

        // Link the account
        await supabase
          .from('subscriber_settings')
          .upsert({
            email: subscriber.email,
            telegram_chat_id: String(chatId),
            telegram_enabled: true,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'email' })

        await sendTelegramMessage(chatId,
          `🎉 <b>연결 완료!</b>\n\n` +
          `${subscriber.name || firstName}님, 환영합니다!\n` +
          `이제 텔레그램으로 학습 알림을 받을 수 있어요.\n\n` +
          `<b>사용 가능한 명령어:</b>\n` +
          `/words - 오늘의 단어\n` +
          `/test - 단어 테스트\n` +
          `/stats - 내 통계`
        )
        return NextResponse.json({ ok: true })
      }

      // Not an email, prompt again
      await sendTelegramMessage(chatId,
        `이메일 주소를 입력해주세요.\n\n` +
        `예시: example@email.com`
      )
      return NextResponse.json({ ok: true })
    }

    // User is linked - handle commands
    const email = existingLink.email

    // Get config
    const { data: configData } = await supabase.from('config').select('key, value')
    const config: Record<string, string> = {}
    configData?.forEach((r: { key: string; value: string }) => { config[r.key] = r.value })
    const currentDay = parseInt(config.CurrentDay || '1')

    // Handle /words command
    if (text === '/words' || text === '오늘의 단어') {
      const { data: words } = await supabase
        .from('words')
        .select('word, meaning')
        .eq('day', currentDay)
        .order('id')

      if (!words || words.length === 0) {
        await sendTelegramMessage(chatId, `Day ${currentDay}에 해당하는 단어가 없습니다.`)
        return NextResponse.json({ ok: true })
      }

      const wordList = words.map((w, i) => `${i + 1}. <b>${w.word}</b> - ${w.meaning}`).join('\n')

      // Record attendance
      const today = new Date().toISOString().split('T')[0]
      await supabase.from('attendance').upsert(
        { email, date: today, type: 'morning', completed: true },
        { onConflict: 'email,date,type' }
      )

      await sendTelegramMessage(chatId,
        `📚 <b>Day ${currentDay} 오늘의 단어</b> (${words.length}개)\n\n` +
        wordList + `\n\n` +
        `테스트를 시작하려면 /test 를 입력하세요.`
      )
      return NextResponse.json({ ok: true })
    }

    // Handle /test command
    if (text === '/test' || text === '테스트') {
      const quizUrl = `${DASHBOARD_URL}/quiz?day=${currentDay}&email=${encodeURIComponent(email)}`

      await sendTelegramMessage(chatId,
        `✏️ <b>Day ${currentDay} 단어 테스트</b>\n\n` +
        `오늘 학습한 단어를 테스트해보세요!\n\n` +
        `아래 링크를 클릭하여 테스트를 시작하세요:`,
        {
          inline_keyboard: [[
            { text: '📝 테스트 시작하기', url: quizUrl }
          ]]
        }
      )
      return NextResponse.json({ ok: true })
    }

    // Handle /review command
    if (text === '/review' || text === '복습' || text === '오답노트') {
      const { data: wrongWords } = await supabase
        .from('wrong_words')
        .select('word, meaning, wrong_count')
        .eq('email', email)
        .eq('mastered', false)
        .order('wrong_count', { ascending: false })
        .limit(10)

      if (!wrongWords || wrongWords.length === 0) {
        await sendTelegramMessage(chatId, `🎉 틀린 단어가 없습니다!\n\n모든 단어를 완벽하게 학습하셨네요.`)
        return NextResponse.json({ ok: true })
      }

      const reviewList = wrongWords.map((w, i) =>
        `${i + 1}. <b>${w.word}</b> (${w.wrong_count}회 오답)\n   → ${w.meaning}`
      ).join('\n\n')

      await sendTelegramMessage(chatId,
        `📝 <b>복습 필요 단어</b> (${wrongWords.length}개)\n\n` +
        reviewList + `\n\n` +
        `대시보드에서 자세히 보기: ${DASHBOARD_URL}/wrong`
      )
      return NextResponse.json({ ok: true })
    }

    // Handle /stats command
    if (text === '/stats' || text === '통계' || text === '내 통계') {
      const { count: totalWords } = await supabase
        .from('words')
        .select('*', { count: 'exact', head: true })

      const { count: wrongCount } = await supabase
        .from('wrong_words')
        .select('*', { count: 'exact', head: true })
        .eq('email', email)
        .eq('mastered', false)

      const { count: masteredCount } = await supabase
        .from('wrong_words')
        .select('*', { count: 'exact', head: true })
        .eq('email', email)
        .eq('mastered', true)

      const today = new Date().toISOString().split('T')[0]
      const { data: todayAtt } = await supabase
        .from('attendance')
        .select('type, completed')
        .eq('email', email)
        .eq('date', today)

      const morning = todayAtt?.some((a: { type: string; completed: boolean }) => a.type === 'morning' && a.completed) ? '✅' : '⬜'
      const lunch = todayAtt?.some((a: { type: string; completed: boolean }) => a.type === 'lunch' && a.completed) ? '✅' : '⬜'
      const evening = todayAtt?.some((a: { type: string; completed: boolean }) => a.type === 'evening' && a.completed) ? '✅' : '⬜'

      await sendTelegramMessage(chatId,
        `📊 <b>나의 학습 통계</b>\n\n` +
        `📅 현재 Day: ${currentDay}\n` +
        `📚 총 단어: ${totalWords || 0}개\n` +
        `✅ 마스터: ${masteredCount || 0}개\n` +
        `❌ 복습 필요: ${wrongCount || 0}개\n\n` +
        `<b>🗓️ 오늘의 출석:</b>\n` +
        `${morning} 아침 단어\n` +
        `${lunch} 점심 테스트\n` +
        `${evening} 저녁 복습\n\n` +
        `상세 통계: ${DASHBOARD_URL}/stats`
      )
      return NextResponse.json({ ok: true })
    }

    // Default: show help
    await sendTelegramMessage(chatId,
      `명령어를 인식하지 못했습니다.\n\n` +
      `/help 를 입력하여 사용 가능한 명령어를 확인하세요.`
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Telegram webhook error:', error)
    return NextResponse.json({ ok: true })
  }
}

// Verify webhook (for initial setup)
export async function GET() {
  return NextResponse.json({ status: 'Telegram webhook endpoint active' })
}
