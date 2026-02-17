import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { sanitizeDay } from '@/lib/auth-middleware'
import { validateWebhookSecret } from '@/lib/url-config'
import { buildKakaoTextPayload } from '@/lib/webhook-contract'
import { checkRateLimit, responseRateLimited } from '@/lib/request-policy'

const DASHBOARD_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://dashboard-keprojects.vercel.app'
const KAKAO_WEBHOOK_SECRET = process.env.KAKAO_WEBHOOK_SECRET || ''

interface KakaoRequest {
  userRequest: {
    utterance: string
    user: {
      id: string
      properties?: {
        plusfriendUserKey?: string
      }
    }
  }
  action?: {
    name?: string
    params?: Record<string, string>
    clientExtra?: Record<string, string>
  }
}

function timingSafeEquals(a: string, b: string): boolean {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  if (aBuf.length !== bBuf.length) {
    return false
  }

  return timingSafeEqual(aBuf, bBuf)
}

function verifyKakaoSignature(payload: string, signature: string | null): boolean {
  if (!KAKAO_WEBHOOK_SECRET) {
    return true
  }

  if (!signature) {
    return false
  }

  const normalized = signature.replace(/^sha256=/i, '').trim()
  const expectedHex = createHmac('sha256', KAKAO_WEBHOOK_SECRET).update(payload).digest('hex')
  const expectedBase64 = createHmac('sha256', KAKAO_WEBHOOK_SECRET).update(payload).digest('base64')

  if (timingSafeEquals(normalized, expectedHex)) {
    return true
  }

  return timingSafeEquals(normalized, expectedBase64)
}

function isKakaoRequest(payload: unknown): payload is KakaoRequest {
  const candidate = payload as {
    userRequest?: {
      utterance?: unknown
      user?: { id?: unknown }
    }
  }

  return (
    !!candidate &&
    !!candidate.userRequest &&
    typeof candidate.userRequest.utterance === 'string' &&
    !!candidate.userRequest.user &&
    typeof candidate.userRequest.user.id === 'string'
  )
}

// Kakao i Open Builder Skill webhook
export async function POST(request: NextRequest) {
  try {
    const rate = checkRateLimit('api:webhook:kakao', request, {
      maxRequests: 120,
      windowMs: 60_000,
    })
    if (!rate.allowed) {
      return responseRateLimited(rate.retryAfter || 1, 'api:webhook:kakao')
    }

    if (!validateWebhookSecret('KAKAO_WEBHOOK_SECRET', KAKAO_WEBHOOK_SECRET)) {
      return NextResponse.json(
        buildKakaoTextPayload('Webhook configuration missing.'),
        { status: 503 }
      )
    }

    const rawBody = await request.text()
    const signature = request.headers.get('x-kakao-signature')

    if (!verifyKakaoSignature(rawBody, signature)) {
      return NextResponse.json(
        buildKakaoTextPayload('Invalid webhook signature.'),
        { status: 401 }
      )
    }

    let parsedBody: unknown
    try {
      parsedBody = JSON.parse(rawBody)
    } catch (parseError) {
      console.warn('Invalid Kakao webhook body', {
        error: parseError instanceof Error ? parseError.message : String(parseError),
      })
      return NextResponse.json(
        buildKakaoTextPayload('Invalid request body.'),
        { status: 400 }
      )
    }

    if (!isKakaoRequest(parsedBody)) {
      return NextResponse.json(
        buildKakaoTextPayload('Invalid payload format.'),
        { status: 400 }
      )
    }

    const body = parsedBody
    const kakaoUserId = body.userRequest.user.id
    const utterance = body.userRequest.utterance.trim()
    const actionName = body.action?.name || ''
    const params = body.action?.params || {}

    const supabase = getServerClient()

    await supabase
      .from('kakao_users')
      .upsert(
        { kakao_user_id: kakaoUserId, last_active: new Date().toISOString() },
        { onConflict: 'kakao_user_id' }
      )

    const { data: kakaoUser } = await supabase
      .from('kakao_users')
      .select('email, name')
      .eq('kakao_user_id', kakaoUserId)
      .single()

    if (actionName === 'register' || utterance.startsWith('등록 ')) {
      const response = await handleRegister(supabase, kakaoUserId, params.email || utterance.replace('등록 ', '').trim())
      return response
    }

    if (!kakaoUser?.email) {
      return NextResponse.json({
        version: '2.0',
        template: {
          outputs: [
            {
              textCard: {
                title: '🦝 옛설판다에 오신 것을 환영합니다!',
                description:
                  '카카오톡으로 매일 비즈니스 영어를 학습할 수 있어요.\n\n먼저 이메일을 등록해주세요.\n아래 버튼을 누르거나 "등록 이메일주소"를 입력해주세요.',
                buttons: [
                  {
                    label: '이메일 등록하기',
                    action: 'block',
                    blockId: 'register_email',
                  },
                ],
              },
            },
          ],
        },
      })
    }

    const { data: configData } = await supabase.from('config').select('key, value')
    const config: Record<string, string> = {}
    configData?.forEach((r: { key: string; value: string }) => { config[r.key] = r.value })
    const currentDay = sanitizeDay(config.CurrentDay || '1')

    if (!currentDay) {
      return NextResponse.json(
        buildKakaoTextPayload('Current day setting is invalid.'),
        { status: 500 }
      )
    }

    if (utterance === '오늘의 단어' || actionName === 'today_words') {
      return handleTodayWords(supabase, kakaoUser.email, kakaoUser.name, currentDay)
    }

    if (utterance === '테스트' || utterance === '단어 테스트' || actionName === 'test') {
      return handleTest(kakaoUser.email, currentDay)
    }

    if (utterance === '복습' || utterance === '오답 노트' || actionName === 'review') {
      return handleReview(supabase, kakaoUser.email)
    }

    if (utterance === '내 통계' || utterance === '통계' || actionName === 'stats') {
      return handleStats(supabase, kakaoUser.email, currentDay)
    }

    if (utterance === '도움말' || utterance === '메뉴' || actionName === 'help') {
      return handleHelp(kakaoUser.name)
    }

    return handleHelp(kakaoUser.name)
  } catch (error) {
    console.error('Kakao webhook error:', error)
    return NextResponse.json(
      buildKakaoTextPayload('Unexpected error occurred.'),
      { status: 500 }
    )
  }
}

// Handle email registration
async function handleRegister(supabase: ReturnType<typeof getServerClient>, kakaoUserId: string, email: string) {
  if (!email || !email.includes('@')) {
    return jsonResponse({
      version: '2.0',
      template: {
        outputs: [
          {
            simpleText: {
              text: '올바른 이메일 주소를 입력해주세요.\n예: 등록 example@email.com',
            },
          },
        ],
      },
    })
  }

  // Check if subscriber exists
  const { data: subscriber } = await supabase
    .from('subscribers')
    .select('email, name')
    .eq('email', email)
    .eq('status', 'active')
    .single()

  if (!subscriber) {
    return jsonResponse({
      version: '2.0',
      template: {
        outputs: [
          {
            simpleText: {
              text: `"${email}" 이메일로 등록된 구독자를 찾을 수 없습니다.\n\n옛설판다 이메일 구독을 먼저 등록해주세요.`,
            },
          },
        ],
      },
    })
  }

  // Link kakao user to subscriber
  await supabase
    .from('kakao_users')
    .upsert(
      {
        kakao_user_id: kakaoUserId,
        email: subscriber.email,
        name: subscriber.name || '학습자',
        last_active: new Date().toISOString(),
      },
      { onConflict: 'kakao_user_id' }
    )

  return jsonResponse({
    version: '2.0',
    template: {
      outputs: [
        {
          textCard: {
            title: '등록 완료! 🎉',
            description: `${subscriber.name || '학습자'}님, 환영합니다!\n\n이제 카카오톡으로 단어 학습을 시작할 수 있어요.\n\n아래 메뉴를 이용해보세요:`,
            buttons: [
              { label: '📚 오늘의 단어', action: 'message', messageText: '오늘의 단어' },
              { label: '✏️ 테스트', action: 'message', messageText: '테스트' },
              { label: '📊 내 통계', action: 'message', messageText: '내 통계' },
            ],
          },
        },
      ],
    },
  })
}

// Handle today's words
async function handleTodayWords(
  supabase: ReturnType<typeof getServerClient>,
  email: string,
  name: string | null,
  currentDay: number
) {
  const { data: words } = await supabase
    .from('words')
    .select('word, meaning')
    .eq('day', currentDay)
    .order('id')

  if (!words || words.length === 0) {
    return jsonResponse({
      version: '2.0',
      template: {
        outputs: [
          { simpleText: { text: `Day ${currentDay}에 해당하는 단어가 없습니다.` } },
        ],
      },
    })
  }

  // Kakao listCard supports max 5 items, so split if needed
  const firstFive = words.slice(0, 5)
  const remaining = words.slice(5)

  const outputs: unknown[] = [
    {
      listCard: {
        header: {
          title: `📚 Day ${currentDay} 오늘의 단어 (${words.length}개)`,
        },
        items: firstFive.map((w: { word: string; meaning: string }, i: number) => ({
          title: `${i + 1}. ${w.word}`,
          description: w.meaning,
        })),
        buttons: [
          {
            label: '✏️ 테스트 시작',
            action: 'message',
            messageText: '테스트',
          },
        ],
      },
    },
  ]

  if (remaining.length > 0) {
    const remainingText = remaining
      .map((w: { word: string; meaning: string }, i: number) => `${i + 6}. ${w.word} - ${w.meaning}`)
      .join('\n')

    outputs.push({
      simpleText: {
        text: `📖 나머지 단어:\n\n${remainingText}`,
      },
    })
  }

  // Record morning attendance
  const today = new Date().toISOString().split('T')[0]
  await supabase.from('attendance').upsert(
    { email, date: today, type: 'morning', completed: true },
    { onConflict: 'email,date,type' }
  )

  return jsonResponse({
    version: '2.0',
    template: { outputs },
  })
}

// Handle test
function handleTest(email: string, currentDay: number) {
  const quizUrl = `${DASHBOARD_URL}/quiz?day=${currentDay}&email=${encodeURIComponent(email)}`

  return jsonResponse({
    version: '2.0',
    template: {
      outputs: [
        {
          textCard: {
            title: `✏️ Day ${currentDay} 단어 테스트`,
            description: '오늘 학습한 단어를 테스트해보세요!\n\n단어를 보고 뜻을 맞추는 방식입니다.\n외운 단어와 재학습할 단어를 체크하세요.',
            buttons: [
              {
                label: '테스트 시작하기',
                action: 'webLink',
                webLinkUrl: quizUrl,
              },
            ],
          },
        },
      ],
    },
  })
}

// Handle review (wrong words)
async function handleReview(supabase: ReturnType<typeof getServerClient>, email: string) {
  const { data: wrongWords } = await supabase
    .from('wrong_words')
    .select('word, meaning, wrong_count')
    .eq('email', email)
    .eq('mastered', false)
    .order('wrong_count', { ascending: false })
    .limit(5)

  if (!wrongWords || wrongWords.length === 0) {
    return jsonResponse({
      version: '2.0',
      template: {
        outputs: [
          {
            simpleText: {
              text: '🎉 틀린 단어가 없습니다!\n\n모든 단어를 완벽하게 학습하셨네요.',
            },
          },
        ],
      },
    })
  }

  return jsonResponse({
    version: '2.0',
    template: {
      outputs: [
        {
          listCard: {
            header: {
              title: `📝 복습 필요 단어 (상위 ${wrongWords.length}개)`,
            },
            items: wrongWords.map((w: { word: string; meaning: string; wrong_count: number }) => ({
              title: `${w.word} (${w.wrong_count}회 오답)`,
              description: w.meaning,
            })),
            buttons: [
              {
                label: '📊 대시보드에서 관리',
                action: 'webLink',
                webLinkUrl: `${DASHBOARD_URL}/wrong`,
              },
            ],
          },
        },
      ],
    },
  })
}

// Handle stats
async function handleStats(supabase: ReturnType<typeof getServerClient>, email: string, currentDay: number) {
  // Get total words
  const { count: totalWords } = await supabase
    .from('words')
    .select('*', { count: 'exact', head: true })

  // Get wrong words count
  const { count: wrongCount } = await supabase
    .from('wrong_words')
    .select('*', { count: 'exact', head: true })
    .eq('email', email)
    .eq('mastered', false)

  // Get mastered count
  const { count: masteredCount } = await supabase
    .from('wrong_words')
    .select('*', { count: 'exact', head: true })
    .eq('email', email)
    .eq('mastered', true)

  // Get today's attendance
  const today = new Date().toISOString().split('T')[0]
  const { data: todayAtt } = await supabase
    .from('attendance')
    .select('type, completed')
    .eq('email', email)
    .eq('date', today)

  const morning = todayAtt?.some((a: { type: string; completed: boolean }) => a.type === 'morning' && a.completed) ? '✅' : '⬜'
  const lunch = todayAtt?.some((a: { type: string; completed: boolean }) => a.type === 'lunch' && a.completed) ? '✅' : '⬜'
  const evening = todayAtt?.some((a: { type: string; completed: boolean }) => a.type === 'evening' && a.completed) ? '✅' : '⬜'

  const statsText = [
    '📊 나의 학습 통계',
    '',
    `📅 현재 Day: ${currentDay}`,
    `📚 총 단어: ${totalWords || 0}개`,
    `✅ 마스터: ${masteredCount || 0}개`,
    `❌ 복습 필요: ${wrongCount || 0}개`,
    '',
    `🗓️ 오늘의 출석:`,
    `${morning} 아침 단어`,
    `${lunch} 점심 테스트`,
    `${evening} 저녁 복습`,
  ].join('\n')

  return jsonResponse({
    version: '2.0',
    template: {
      outputs: [
        {
          textCard: {
            title: '📊 나의 학습 통계',
            description: statsText,
            buttons: [
              {
                label: '📈 상세 통계 보기',
                action: 'webLink',
                webLinkUrl: `${DASHBOARD_URL}/stats`,
              },
            ],
          },
        },
      ],
    },
  })
}

// Handle help/menu
function handleHelp(name: string | null) {
  return jsonResponse({
    version: '2.0',
    template: {
      outputs: [
        {
          textCard: {
            title: `🦝 옛설판다 메뉴`,
            description: `${name || '학습자'}님, 무엇을 도와드릴까요?\n\n아래 메뉴를 선택하거나 직접 입력해주세요:`,
            buttons: [
              { label: '📚 오늘의 단어', action: 'message', messageText: '오늘의 단어' },
              { label: '✏️ 테스트', action: 'message', messageText: '테스트' },
              { label: '📝 복습', action: 'message', messageText: '복습' },
            ],
          },
        },
      ],
      quickReplies: [
        { label: '📊 내 통계', action: 'message', messageText: '내 통계' },
        { label: '❓ 도움말', action: 'message', messageText: '도움말' },
      ],
    },
  })
}

function jsonResponse(data: unknown) {
  return NextResponse.json(data)
}
