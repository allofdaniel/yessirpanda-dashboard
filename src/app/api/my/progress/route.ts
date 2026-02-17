import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase'
import { requireAuth, verifyEmailOwnership, sanitizeDay } from '@/lib/auth-middleware'
import {
  apiError,
  parseFailureToResponse,
  parseJsonRequest,
  parseEmail,
} from '@/lib/api-contract'
import { checkRateLimit, responseRateLimited } from '@/lib/request-policy'

const DEFAULT_ACTIVE_DAYS = [1, 2, 3, 4, 5]

type ProgressAction = 'advance' | 'set'

interface ProgressBody {
  email: string
  action: ProgressAction
  day?: string | number | null
}

function parseAction(raw: unknown) {
  if (typeof raw !== 'string') {
    return {
      success: false,
      code: 'INVALID_ACTION',
      message: 'action must be a string',
    } as const
  }

  const action = raw.trim().toLowerCase()
  if (action !== 'advance' && action !== 'set') {
    return {
      success: false,
      code: 'INVALID_ACTION',
      message: 'action must be "advance" or "set"',
    } as const
  }

  return { success: true, value: action as ProgressAction }
}

function parseProgressDay(raw: unknown) {
  const value = sanitizeDay(typeof raw === 'string' || typeof raw === 'number' ? raw : null)
  if (!value) {
    return {
      success: false,
      code: 'INVALID_DAY',
      message: 'day is invalid',
    } as const
  }
  return { success: true, value }
}

// GET /api/my/progress - Get user's personal progress
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return apiError('UNAUTHORIZED', 'Authentication required')
    const { user } = authResult

    const emailParam = request.nextUrl.searchParams.get('email')
    const email = parseEmail(emailParam || user.email)

    if (!email) return apiError('INVALID_INPUT', 'Valid email required')

    if (!verifyEmailOwnership(user.email, email)) {
      return apiError('FORBIDDEN', 'Forbidden')
    }

    const supabase = getServerClient()

    const { data: subscriber, error } = await supabase
      .from('subscribers')
      .select('current_day, started_at, last_lesson_at, status, active_days')
      .eq('email', email)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        const { data: newSub, error: insertError } = await supabase
          .from('subscribers')
          .insert({
            email,
            name: '학습자',
            status: 'active',
            current_day: 1,
            started_at: new Date().toISOString(),
          })
          .select('current_day, started_at, last_lesson_at, status, active_days')
          .single()

        if (insertError) {
          return apiError('DEPENDENCY_ERROR', insertError.message)
        }

        return NextResponse.json({
          current_day: newSub?.current_day || 1,
          started_at: newSub?.started_at,
          last_lesson_at: newSub?.last_lesson_at,
          status: newSub?.status || 'active',
          active_days: newSub?.active_days || DEFAULT_ACTIVE_DAYS,
        })
      }

      return apiError('DEPENDENCY_ERROR', error.message)
    }

    return NextResponse.json({
      current_day: subscriber?.current_day || 1,
      started_at: subscriber?.started_at,
      last_lesson_at: subscriber?.last_lesson_at,
      status: subscriber?.status || 'active',
      active_days: subscriber?.active_days || DEFAULT_ACTIVE_DAYS,
    })
  } catch (error) {
    console.error('[My Progress API] GET failed:', error)
    return apiError('DEPENDENCY_ERROR', error instanceof Error ? error.message : 'Internal error')
  }
}

// POST /api/my/progress - Update user's progress (advance/set day)
export async function POST(request: NextRequest) {
  try {
    const rate = checkRateLimit('api:my:progress', request, {
      maxRequests: 60,
      windowMs: 60_000,
    })
    if (!rate.allowed) {
      return responseRateLimited(rate.retryAfter || 1, 'api:my:progress')
    }

    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return apiError('UNAUTHORIZED', 'Authentication required')
    const { user } = authResult

    const parsed = await parseJsonRequest<ProgressBody>(request, {
      email: {
        required: true,
        parse: (value) => {
          const email = parseEmail(typeof value === 'string' ? value : '')
          if (!email) {
            return {
              success: false,
              code: 'INVALID_EMAIL',
              message: 'Invalid email',
            }
          }
          return { success: true, value: email }
        },
      },
      action: { required: true, parse: parseAction },
      day: {
        required: false,
        parse: (value) => {
          if (value === undefined || value === null) {
            return { success: true, value: undefined }
          }
          return parseProgressDay(value)
        },
      },
    })

    if (!parsed.success) {
      return parseFailureToResponse(parsed)
    }

    const { email, action, day } = parsed.value

    if (!verifyEmailOwnership(user.email, email)) {
      return apiError('FORBIDDEN', 'Forbidden')
    }

    const supabase = getServerClient()

    if (action === 'advance') {
      if (day !== undefined) {
        const { data, error } = await supabase
          .from('subscribers')
          .update({
            current_day: day,
            last_lesson_at: new Date().toISOString(),
          })
          .eq('email', email)
          .select('current_day')
          .single()

        if (error) {
          return apiError('DEPENDENCY_ERROR', error.message)
        }

        return NextResponse.json({ success: true, current_day: data?.current_day })
      }

      const { data: newDay, error: rpcError } = await supabase.rpc('advance_user_day', {
        user_email: email,
      })

      if (rpcError) {
        return apiError('DEPENDENCY_ERROR', rpcError.message)
      }

      return NextResponse.json({ success: true, current_day: newDay })
    }

    const targetDay = day
    if (targetDay === undefined) {
      return apiError('INVALID_INPUT', 'day is required when action is set')
    }

    const { error } = await supabase
      .from('subscribers')
      .update({ current_day: targetDay, last_lesson_at: new Date().toISOString() })
      .eq('email', email)

    if (error) {
      return apiError('DEPENDENCY_ERROR', error.message)
    }

    return NextResponse.json({ success: true, current_day: targetDay })
  } catch (error) {
    console.error('[My Progress API] POST failed:', error)
    return apiError('DEPENDENCY_ERROR', error instanceof Error ? error.message : 'Internal error')
  }
}

