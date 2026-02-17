import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getDashboardUrl } from '../_shared/action-links.ts'

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

// Solapi API for sending KakaoTalk messages (?뚮┝??移쒓뎄??
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
      type: 'ATA', // ?뚮┝??(Alimtalk - Template-based KakaoTalk message)
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
    const dashboardUrl = getDashboardUrl()

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
  const templateId = '129026' // KakaoTalk message template ID
  let buttons: Array<{ buttonType: string; buttonName: string; linkMobile?: string; linkPc?: string }> = []

    if (type === 'morning') {
      const wordList = words.map((w: { word: string; meaning: string }, i: number) =>
        `${i + 1}. ${w.word} - ${w.meaning}`
      ).join('\n')

      messageText = `?맻 ?쏆꽕?먮떎 Day ${currentDay}\n\n?뱴 ?ㅻ뒛??鍮꾩쫰?덉뒪 ?곸뼱 (${words.length}媛?\n\n${wordList}\n\n?뮕 ?⑥뼱瑜?3踰덉뵫 ?뚮━ ?댁뼱 ?쎌뼱蹂댁꽭??`

      buttons = [
        {
          buttonType: 'WL',
          buttonName: '?륅툘 ?뚯뒪???섍린',
          linkMobile: `${dashboardUrl}/quiz?day=${currentDay}&email=#{email}`,
          linkPc: `${dashboardUrl}/quiz?day=${currentDay}&email=#{email}`,
        },
        {
          buttonType: 'WL',
          buttonName: '일정 미루기',
          linkMobile: `${dashboardUrl}/postpone?email=#{email}&day=${currentDay}`,
          linkPc: `${dashboardUrl}/postpone?email=#{email}&day=${currentDay}`,
        },
        {
          buttonType: 'WL',
          buttonName: '바로 시작',
          linkMobile: `${dashboardUrl}/login`,
          linkPc: `${dashboardUrl}/login`,
        },
      ]
    } else if (type === 'test') {
      messageText = `?맻 ?쏆꽕?먮떎 Day ${currentDay}\n\n?륅툘 ?먯떖 ?뚯뒪???쒓컙?댁뿉??\n\n?ㅻ뒛 ?꾩묠???숈뒿??${words.length}媛쒖쓽 ?⑥뼱瑜??뚯뒪?명빐蹂댁꽭??\n\n?몄슫 ?⑥뼱? ?ы븰?듯븷 ?⑥뼱瑜?泥댄겕?섏꽭??`

      buttons = [
        {
          buttonType: 'WL',
          buttonName: '?뚯뒪???쒖옉?섍린',
          linkMobile: `${dashboardUrl}/quiz?day=${currentDay}&email=#{email}`,
          linkPc: `${dashboardUrl}/quiz?day=${currentDay}&email=#{email}`,
        },
        {
          buttonType: 'WL',
          buttonName: '일정 미루기',
          linkMobile: `${dashboardUrl}/postpone?email=#{email}&day=${currentDay}`,
          linkPc: `${dashboardUrl}/postpone?email=#{email}&day=${currentDay}`,
        },
      ]
    } else if (type === 'review') {
      messageText = `?맻 ?쏆꽕?먮떎 Day ${currentDay}\n\n?뱷 ???蹂듭뒿 ?쒓컙?댁뿉??\n\n?ㅻ뒛 ?숈뒿???⑥뼱瑜???踰???蹂듭뒿?대낫?몄슂.\n?由??⑥뼱????쒕낫?쒖뿉???뺤씤?????덉뼱??`

      buttons = [
        {
          buttonType: 'WL',
          buttonName: '蹂듭뒿?섍린',
          linkMobile: `${dashboardUrl}/quiz?day=${currentDay}&email=#{email}`,
          linkPc: `${dashboardUrl}/quiz?day=${currentDay}&email=#{email}`,
        },
        {
          buttonType: 'WL',
          buttonName: '?ㅻ떟 ?명듃',
          linkMobile: `${dashboardUrl}/wrong`,
          linkPc: `${dashboardUrl}/wrong`,
        },
      ]
    }

    // If Solapi is configured, send via Solapi (?뚮┝??
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

