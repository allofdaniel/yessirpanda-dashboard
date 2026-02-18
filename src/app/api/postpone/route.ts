import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase'
import { requireAuth, verifyEmailOwnership, sanitizeEmail, sanitizeDay } from '@/lib/auth-middleware'
import {
  apiError,
  parseFailureToResponse,
  parseJsonRequest,
} from '@/lib/api-contract'
import { checkRateLimit, responseRateLimited } from '@/lib/request-policy'

interface PostponeBody {
  email?: string;
  day?: string | number;
}

function parseOptionalEmail(raw: unknown) {
  if (raw === undefined) {
    return { success: true, value: undefined as string | undefined }
  }

  const parsed = sanitizeEmail(typeof raw === 'string' ? raw : null)
  if (!parsed) {
    return { success: false, code: 'INVALID_EMAIL', message: 'Invalid email format' }
  }

  return { success: true, value: parsed }
}

function parseOptionalDay(raw: unknown) {
  if (raw === undefined) {
    return { success: true, value: undefined as number | undefined }
  }

  const parsed = sanitizeDay(typeof raw === 'string' || typeof raw === 'number' ? raw : null)
  if (!parsed) {
    return { success: false, code: 'INVALID_DAY', message: 'Day must be a positive integer' }
  }

  return { success: true, value: parsed }
}

function previewEmail(email: string | null | undefined) {
  if (!email) return 'unknown'
  return `${email.substring(0, 3)}***`
}

// POST: Postpone today's words to tomorrow
// NOTE: This endpoint allows unauthenticated access when email is provided in body
// (for email link clicks). Rate limiting protects against abuse.
export async function POST(request: NextRequest) {
  try {
    const rate = checkRateLimit('api:postpone:post', request, {
      maxRequests: 10,  // Stricter rate limit for unauthenticated
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return responseRateLimited(rate.retryAfter || 1, 'api:postpone:post');
    }

    const parsed = await parseJsonRequest<PostponeBody>(request, {
      email: { required: false, parse: parseOptionalEmail },
      day: { required: false, parse: parseOptionalDay },
    })

    if (!parsed.success) {
      return parseFailureToResponse(parsed)
    }

    // Try to get authenticated user, but don't require it
    let userEmail: string | null = null
    const authResult = await requireAuth(request)
    if (!(authResult instanceof NextResponse)) {
      userEmail = authResult.user.email
    }

    const bodyEmail = parsed.value.email || userEmail
    const requestedDay = parsed.value.day
    const sanitizedEmail = sanitizeEmail(bodyEmail)

    if (!sanitizedEmail) {
      return apiError('INVALID_INPUT', 'Email is required')
    }

    // If authenticated, verify email ownership
    if (userEmail && !verifyEmailOwnership(userEmail, sanitizedEmail)) {
      return apiError('FORBIDDEN', 'You can only update your own data')
    }

    const supabase = getServerClient()
    const { data: configData, error: configError } = await supabase
      .from('config')
      .select('key, value')

    if (configError) {
      console.error('[Postpone POST] Config fetch failed:', {
        email: previewEmail(sanitizedEmail),
        error: configError.message,
      })
      return apiError('DEPENDENCY_ERROR', 'Could not load current day configuration')
    }

    const config: Record<string, string> = {}
    configData?.forEach((r: { key: string; value: string }) => {
      config[r.key] = r.value
    })

    const currentDay = requestedDay ?? sanitizeDay(config.CurrentDay || '1')
    if (!currentDay) {
      console.error('[Postpone POST] Invalid current day:', {
        valueFromRequest: requestedDay,
        valueFromConfig: config.CurrentDay,
        email: previewEmail(sanitizedEmail),
      })
      return apiError('CONFIG_MISSING', 'Current day is invalid. Please contact support.')
    }

    const { data: subscriber, error: subscriberError } = await supabase
      .from('subscribers')
      .select('id, postponed_days')
      .eq('email', sanitizedEmail)
      .single()

    if (subscriberError && subscriberError.code !== 'PGRST116') {
      console.error('[Postpone POST] Subscriber query failed:', {
        email: previewEmail(sanitizedEmail),
        error: subscriberError.message,
        code: subscriberError.code,
      })
      return apiError('DEPENDENCY_ERROR', 'Could not retrieve subscriber information')
    }

    if (!subscriber) {
      console.warn('[Postpone POST] Subscriber not found:', {
        email: previewEmail(sanitizedEmail),
      })
      return apiError('NOT_FOUND', 'Subscriber not found')
    }

    const postponedDays = subscriber.postponed_days || []
    if (postponedDays.includes(currentDay)) {
      return apiError('INVALID_INPUT', `Day ${currentDay} is already scheduled for tomorrow`)
    }

    const { error: updateError } = await supabase
      .from('subscribers')
      .update({
        postponed_days: [...postponedDays, currentDay],
        last_postponed_at: new Date().toISOString(),
      })
      .eq('email', sanitizedEmail)

    if (updateError) {
      console.error('[Postpone POST] Subscriber update failed:', {
        email: previewEmail(sanitizedEmail),
        error: updateError.message,
      })
      return apiError('DEPENDENCY_ERROR', 'Could not save postpone status')
    }

    const today = new Date().toISOString().split('T')[0]
    const { error: attendanceError } = await supabase.from('attendance').upsert({
      email: sanitizedEmail,
      date: today,
      type: 'postponed',
      completed: false,
      day: currentDay,
    }, { onConflict: 'email,date,type' })

    if (attendanceError) {
      console.warn('[Postpone POST] Attendance record failed (non-critical):', {
        email: previewEmail(sanitizedEmail),
        date: today,
        error: attendanceError.message,
      })
    }

    return NextResponse.json({
      success: true,
      message: `Day ${currentDay} has been postponed to tomorrow`,
      postponedDay: currentDay,
    })
  } catch (error) {
    console.error('[Postpone POST] Unexpected error:', error)
    return apiError('DEPENDENCY_ERROR', 'An unexpected error occurred while processing your request')
  }
}

// GET: Check if user has postponed days to review
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return apiError('UNAUTHORIZED', 'Authentication required')
    const { user } = authResult

    const { searchParams } = new URL(request.url)
    const requestedEmail = sanitizeEmail(searchParams.get('email')) || user.email

    if (!verifyEmailOwnership(user.email, requestedEmail)) {
      return apiError('FORBIDDEN', 'Forbidden')
    }

    const supabase = getServerClient()
    const { data: subscriber, error: subscriberError } = await supabase
      .from('subscribers')
      .select('postponed_days')
      .eq('email', requestedEmail)
      .single()

    if (subscriberError && subscriberError.code !== 'PGRST116') {
      console.error('[Postpone GET] Subscriber query failed:', {
        email: previewEmail(requestedEmail),
        error: subscriberError.message,
        code: subscriberError.code,
      })
      return apiError('DEPENDENCY_ERROR', 'Could not retrieve postponed days')
    }

    if (!subscriber) {
      return NextResponse.json({
        postponedDays: [],
        message: 'No subscriber found',
      })
    }

    const postponedDays = subscriber.postponed_days || []
    if (!Array.isArray(postponedDays)) {
      console.warn('[Postpone GET] Invalid postponed days data:', {
        email: previewEmail(requestedEmail),
        type: typeof postponedDays,
      })
      return NextResponse.json({ postponedDays: [] })
    }

    const validDays = postponedDays.filter((d: unknown) => typeof d === 'number' && Number.isInteger(d) && d > 0)
    return NextResponse.json({ postponedDays: validDays })
  } catch (error) {
    console.error('[Postpone GET] Unexpected error:', {
      error: error instanceof Error ? error.message : String(error),
    })
    return apiError('DEPENDENCY_ERROR', 'An unexpected error occurred while retrieving postponed days')
  }
}

// DELETE: Clear a postponed day after completing it
export async function DELETE(request: NextRequest) {
  try {
    const rate = checkRateLimit('api:postpone:delete', request, {
      maxRequests: 60,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return responseRateLimited(rate.retryAfter || 1, 'api:postpone:delete');
    }

    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return apiError('UNAUTHORIZED', 'Authentication required')
    const { user } = authResult

    const parsed = await parseJsonRequest<PostponeBody>(request, {
      email: { required: false, parse: parseOptionalEmail },
      day: { required: false, parse: parseOptionalDay },
    })

    if (!parsed.success) {
      return parseFailureToResponse(parsed)
    }

    const bodyEmail = parsed.value.email || user.email
    const sanitizedEmail = sanitizeEmail(bodyEmail)
    const sanitizedDay = parsed.value.day

    if (!sanitizedEmail) {
      return apiError('INVALID_INPUT', 'Email is required')
    }

    if (!verifyEmailOwnership(user.email, sanitizedEmail)) {
      return apiError('FORBIDDEN', 'You can only update your own data')
    }

    if (!sanitizedDay) {
      return apiError('INVALID_INPUT', 'Day is required')
    }

    const supabase = getServerClient()

    const { data: subscriber, error: subscriberError } = await supabase
      .from('subscribers')
      .select('postponed_days')
      .eq('email', sanitizedEmail)
      .single()

    if (subscriberError && subscriberError.code !== 'PGRST116') {
      console.error('[Postpone DELETE] Subscriber query failed:', {
        email: previewEmail(sanitizedEmail),
        error: subscriberError.message,
      })
      return apiError('DEPENDENCY_ERROR', 'Could not retrieve subscriber information')
    }

    if (!subscriber) {
      return apiError('NOT_FOUND', 'Subscriber not found')
    }

    const postponedDays = subscriber.postponed_days || []
    if (!postponedDays.includes(sanitizedDay)) {
      return apiError('INVALID_INPUT', `Day ${sanitizedDay} is not in your postponed list`)
    }

    const updatedPostponedDays = postponedDays.filter((d: number) => d !== sanitizedDay)
    const { error: updateError } = await supabase
      .from('subscribers')
      .update({ postponed_days: updatedPostponedDays })
      .eq('email', sanitizedEmail)

    if (updateError) {
      console.error('[Postpone DELETE] Update failed:', {
        email: previewEmail(sanitizedEmail),
        day: sanitizedDay,
        error: updateError.message,
      })
      return apiError('DEPENDENCY_ERROR', 'Could not remove day from postponed list')
    }

    return NextResponse.json({
      success: true,
      message: `Day ${sanitizedDay} removed`,
    })
  } catch (error) {
    console.error('[Postpone DELETE] Unexpected error:', {
      error: error instanceof Error ? error.message : String(error),
    })
    return apiError('DEPENDENCY_ERROR', 'An unexpected error occurred while processing your request')
  }
}

