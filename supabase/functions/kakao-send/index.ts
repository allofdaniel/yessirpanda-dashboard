import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// HMAC-SHA256 using Web Crypto API
async function hmacSha256(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// Solapi API for sending KakaoTalk messages (알림톡/친구톡)
// Docs: https://docs.solapi.com/
// Template ID 129026 is used for daily words messages
async function sendSolapiMessage(
  apiKey: string,
  apiSecret: string,
  params: {
    to: string
    from: string
    text: string
    kakaoOptions?: {
      pfId: string
      templateId?: string
      variables?: Record<string, string>
      buttons?: Array<{
        buttonType: string
        buttonName: string
        linkMobile?: string
        linkPc?: string
      }>
    }
  }
) {
  const date = new Date().toISOString()
  const salt = crypto.randomUUID()
  const signature = await hmacSha256(apiSecret, date + salt)

  const authHeader = `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`

  const body: Record<string, unknown> = {
    message: {
      to: params.to,
      from: params.from,
      text: params.text,
      type: 'ATA', // 알림톡 (Alimtalk - Template-based KakaoTalk message)
      kakaoOptions: params.kakaoOptions,
    },
  }

  const res = await fetch('https://api.solapi.com/messages/v4/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
    },
    body: JSON.stringify(body),
  })

  return await res.json()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const solapiApiKey = Deno.env.get('SOLAPI_API_KEY') || ''
    const solapiApiSecret = Deno.env.get('SOLAPI_API_SECRET') || ''
    const solapiPfId = Deno.env.get('SOLAPI_PF_ID') || '' // KakaoTalk Channel PF ID
    const solapiSender = Deno.env.get('SOLAPI_SENDER') || '' // Sender phone number
    const dashboardUrl = Deno.env.get('DASHBOARD_URL') || 'https://dashboard-keprojects.vercel.app'

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Parse request body for message type
    const { type = 'morning' } = await req.json().catch(() => ({ type: 'morning' }))

    // Get config
    const { data: configData } = await supabase.from('config').select('key, value')
    const config: Record<string, string> = {}
    configData?.forEach((r: { key: string; value: string }) => { config[r.key] = r.value })
    const currentDay = parseInt(config.CurrentDay || '1')

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

    // Get subscribers who have 'kakao' in their channels array
    const { data: kakaoSubscribers } = await supabase
      .from('subscribers')
      .select('email, name, phone')
      .eq('status', 'active')
      .contains('channels', ['kakao'])

    if (!kakaoSubscribers || kakaoSubscribers.length === 0) {
      return new Response(JSON.stringify({ error: 'No subscribers with KakaoTalk channel enabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    // Build message based on type
    let messageText = ''
    let templateId = '129026' // KakaoTalk message template ID
    let buttons: Array<{ buttonType: string; buttonName: string; linkMobile?: string; linkPc?: string }> = []

    if (type === 'morning') {
      const wordList = words.map((w: { word: string; meaning: string }, i: number) =>
        `${i + 1}. ${w.word} - ${w.meaning}`
      ).join('\n')

      messageText = `🐼 옛설판다 Day ${currentDay}\n\n📚 오늘의 비즈니스 영어 (${words.length}개)\n\n${wordList}\n\n💡 단어를 3번씩 소리 내어 읽어보세요!`

      buttons = [
        {
          buttonType: 'WL',
          buttonName: '✏️ 테스트 하기',
          linkMobile: `${dashboardUrl}/quiz?day=${currentDay}&email=#{email}`,
          linkPc: `${dashboardUrl}/quiz?day=${currentDay}&email=#{email}`,
        },
        {
          buttonType: 'WL',
          buttonName: '⏰ 내일로 미루기',
          linkMobile: `${dashboardUrl}/postpone?email=#{email}&day=${currentDay}`,
          linkPc: `${dashboardUrl}/postpone?email=#{email}&day=${currentDay}`,
        },
        {
          buttonType: 'WL',
          buttonName: '📊 대시보드',
          linkMobile: `${dashboardUrl}/login`,
          linkPc: `${dashboardUrl}/login`,
        },
      ]
    } else if (type === 'test') {
      messageText = `🐼 옛설판다 Day ${currentDay}\n\n✏️ 점심 테스트 시간이에요!\n\n오늘 아침에 학습한 ${words.length}개의 단어를 테스트해보세요.\n\n외운 단어와 재학습할 단어를 체크하세요!`

      buttons = [
        {
          buttonType: 'WL',
          buttonName: '테스트 시작하기',
          linkMobile: `${dashboardUrl}/quiz?day=${currentDay}&email=#{email}`,
          linkPc: `${dashboardUrl}/quiz?day=${currentDay}&email=#{email}`,
        },
        {
          buttonType: 'WL',
          buttonName: '⏰ 내일로 미루기',
          linkMobile: `${dashboardUrl}/postpone?email=#{email}&day=${currentDay}`,
          linkPc: `${dashboardUrl}/postpone?email=#{email}&day=${currentDay}`,
        },
      ]
    } else if (type === 'review') {
      messageText = `🐼 옛설판다 Day ${currentDay}\n\n📝 저녁 복습 시간이에요!\n\n오늘 학습한 단어를 한 번 더 복습해보세요.\n틀린 단어는 대시보드에서 확인할 수 있어요.`

      buttons = [
        {
          buttonType: 'WL',
          buttonName: '복습하기',
          linkMobile: `${dashboardUrl}/quiz?day=${currentDay}&email=#{email}`,
          linkPc: `${dashboardUrl}/quiz?day=${currentDay}&email=#{email}`,
        },
        {
          buttonType: 'WL',
          buttonName: '오답 노트',
          linkMobile: `${dashboardUrl}/wrong`,
          linkPc: `${dashboardUrl}/wrong`,
        },
      ]
    }

    // If Solapi is configured, send via Solapi (알림톡)
    if (solapiApiKey && solapiApiSecret && solapiPfId && solapiSender) {
      const results = []
      for (const subscriber of kakaoSubscribers) {
        // Check if phone number exists
        if (!subscriber.phone || subscriber.phone.trim() === '') {
          results.push({
            email: subscriber.email,
            status: 'skipped',
            error: 'No phone number registered'
          })
          continue
        }

        // Replace email placeholder in button URLs
        const userButtons = buttons.map(b => ({
          ...b,
          linkMobile: b.linkMobile?.replace('#{email}', encodeURIComponent(subscriber.email)),
          linkPc: b.linkPc?.replace('#{email}', encodeURIComponent(subscriber.email)),
        }))

        const personalMessage = messageText.replace('#{name}', subscriber.name || '학습자')

        try {
          const result = await sendSolapiMessage(solapiApiKey, solapiApiSecret, {
            to: subscriber.phone,
            from: solapiSender,
            text: personalMessage,
            kakaoOptions: {
              pfId: solapiPfId,
              templateId: templateId,
              buttons: userButtons,
            },
          })
          results.push({ email: subscriber.email, status: 'sent', result })
        } catch (err) {
          results.push({ email: subscriber.email, status: 'error', error: (err as Error).message })
        }
      }

      return new Response(JSON.stringify({
        success: true,
        type,
        day: currentDay,
        sent: results.filter(r => r.status === 'sent').length,
        total: kakaoSubscribers.length,
        results,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fallback: Return message data for manual sending or other integrations
    return new Response(JSON.stringify({
      success: true,
      type,
      day: currentDay,
      message: messageText,
      buttons,
      templateId: templateId,
      subscribers: kakaoSubscribers.map((s: { email: string; name: string; phone?: string }) => ({
        email: s.email,
        name: s.name,
        hasPhone: !!s.phone
      })),
      note: 'Solapi credentials not configured. Set SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_PF_ID, and SOLAPI_SENDER environment variables to enable automatic sending.',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('kakao-send error:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
