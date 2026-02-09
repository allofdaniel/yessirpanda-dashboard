import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase'

// POST: Postpone today's words to tomorrow
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    let email: string
    let day: number | undefined
    try {
      const body = await request.json()
      email = body.email
      day = body.day
    } catch (parseError) {
      console.warn('[Postpone POST] Invalid JSON:', {
        error: parseError instanceof Error ? parseError.message : String(parseError),
      })
      return NextResponse.json({
        error: 'Invalid request format',
        details: 'Body must be valid JSON with email field',
      }, { status: 400 })
    }

    // Validate email
    if (!email || typeof email !== 'string' || !email.trim()) {
      console.warn('[Postpone POST] Missing or invalid email:', { email })
      return NextResponse.json({
        error: 'Email is required',
        details: 'Please provide a valid email address',
      }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      console.warn('[Postpone POST] Invalid email format:', { email: email.substring(0, 3) + '***' })
      return NextResponse.json({
        error: 'Invalid email format',
        details: 'Please provide a valid email address',
      }, { status: 400 })
    }

    // Validate day if provided
    if (day !== undefined) {
      if (typeof day !== 'number' || !Number.isInteger(day) || day < 1) {
        console.warn('[Postpone POST] Invalid day number:', { day, email: email.substring(0, 3) + '***' })
        return NextResponse.json({
          error: 'Invalid day number',
          details: 'Day must be a positive integer',
        }, { status: 400 })
      }
      if (day > 10000) {
        console.warn('[Postpone POST] Day number unreasonably high:', { day, email: email.substring(0, 3) + '***' })
        return NextResponse.json({
          error: 'Invalid day number',
          details: 'Day number exceeds reasonable bounds',
        }, { status: 400 })
      }
    }

    const supabase = getServerClient()

    // Get current config
    const { data: configData, error: configError } = await supabase
      .from('config')
      .select('key, value')

    if (configError) {
      console.error('[Postpone POST] Config fetch failed:', {
        email: email.substring(0, 3) + '***',
        error: configError.message,
      })
      return NextResponse.json({
        error: 'Configuration error',
        details: 'Could not load current day configuration',
      }, { status: 500 })
    }

    const config: Record<string, string> = {}
    configData?.forEach((r: { key: string; value: string }) => {
      config[r.key] = r.value
    })

    const currentDay = day || parseInt(config.CurrentDay || '1', 10)

    // Validate parsed day
    if (!Number.isInteger(currentDay) || currentDay < 1) {
      console.error('[Postpone POST] Invalid current day value:', {
        currentDay,
        configValue: config.CurrentDay,
        email: email.substring(0, 3) + '***',
      })
      return NextResponse.json({
        error: 'Invalid day configuration',
        details: 'Current day is invalid. Please contact support.',
      }, { status: 500 })
    }

    // Get subscriber
    const { data: subscriber, error: subscriberError } = await supabase
      .from('subscribers')
      .select('id, postponed_days')
      .eq('email', email.trim())
      .single()

    if (subscriberError && subscriberError.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      console.error('[Postpone POST] Subscriber query failed:', {
        email: email.substring(0, 3) + '***',
        error: subscriberError.message,
        code: subscriberError.code,
      })
      return NextResponse.json({
        error: 'Database error',
        details: 'Could not retrieve subscriber information',
      }, { status: 500 })
    }

    if (!subscriber) {
      console.warn('[Postpone POST] Subscriber not found:', { email: email.substring(0, 3) + '***' })
      return NextResponse.json({
        error: 'Subscriber not found',
        details: 'Please log in first to postpone words',
      }, { status: 404 })
    }

    // Get postponed days array and check for duplicates
    const postponedDays = subscriber.postponed_days || []
    const alreadyPostponed = postponedDays.includes(currentDay)

    if (alreadyPostponed) {
      console.info('[Postpone POST] Day already postponed:', {
        email: email.substring(0, 3) + '***',
        day: currentDay,
      })
      return NextResponse.json({
        error: 'Already postponed',
        details: `Day ${currentDay} is already scheduled for tomorrow`,
        postponedDay: currentDay,
      }, { status: 409 })
    }

    // Add day to postponed array
    const updatedPostponedDays = [...postponedDays, currentDay]

    // Update subscriber
    const { error: updateError } = await supabase
      .from('subscribers')
      .update({
        postponed_days: updatedPostponedDays,
        last_postponed_at: new Date().toISOString(),
      })
      .eq('email', email.trim())

    if (updateError) {
      console.error('[Postpone POST] Subscriber update failed:', {
        email: email.substring(0, 3) + '***',
        error: updateError.message,
      })
      return NextResponse.json({
        error: 'Update failed',
        details: 'Could not save postpone status',
      }, { status: 500 })
    }

    // Also mark today's attendance as postponed (not skipped)
    const today = new Date().toISOString().split('T')[0]
    const { error: attendanceError } = await supabase.from('attendance').upsert({
      email: email.trim(),
      date: today,
      type: 'postponed',
      completed: false,
      day: currentDay,
    }, { onConflict: 'email,date,type' })

    if (attendanceError) {
      console.warn('[Postpone POST] Attendance record failed (non-critical):', {
        email: email.substring(0, 3) + '***',
        date: today,
        error: attendanceError.message,
      })
      // Don't fail the request - attendance tracking is supplementary
    }

    console.info('[Postpone POST] Day successfully postponed:', {
      email: email.substring(0, 3) + '***',
      day: currentDay,
    })

    return NextResponse.json({
      success: true,
      message: `Day ${currentDay} 단어가 내일로 미뤄졌습니다.`,
      postponedDay: currentDay,
    })
  } catch (error) {
    console.error('[Postpone POST] Unexpected error:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json({
      error: 'Internal server error',
      details: 'An unexpected error occurred while processing your request',
    }, { status: 500 })
  }
}

// GET: Check if user has postponed days to review
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    // Validate email
    if (!email || !email.trim()) {
      console.warn('[Postpone GET] Missing email parameter')
      return NextResponse.json({
        error: 'Email is required',
        details: 'Please provide your email address',
      }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      console.warn('[Postpone GET] Invalid email format')
      return NextResponse.json({
        error: 'Invalid email format',
        details: 'Please provide a valid email address',
      }, { status: 400 })
    }

    const supabase = getServerClient()

    const { data: subscriber, error: subscriberError } = await supabase
      .from('subscribers')
      .select('postponed_days')
      .eq('email', email.trim())
      .single()

    if (subscriberError && subscriberError.code !== 'PGRST116') {
      // PGRST116 = no rows returned (expected for some cases)
      console.error('[Postpone GET] Subscriber query failed:', {
        email: email.substring(0, 3) + '***',
        error: subscriberError.message,
        code: subscriberError.code,
      })
      return NextResponse.json({
        error: 'Database error',
        details: 'Could not retrieve postponed days',
      }, { status: 500 })
    }

    if (!subscriber) {
      console.info('[Postpone GET] Subscriber not found, returning empty list:', {
        email: email.substring(0, 3) + '***',
      })
      return NextResponse.json({
        postponedDays: [],
        message: 'No subscriber found',
      }, { status: 200 })
    }

    const postponedDays = subscriber.postponed_days || []

    // Validate postponed days array
    if (!Array.isArray(postponedDays)) {
      console.warn('[Postpone GET] Postponed days is not an array, returning empty:', {
        email: email.substring(0, 3) + '***',
        type: typeof postponedDays,
      })
      return NextResponse.json({
        postponedDays: [],
        warning: 'Postponed days data was invalid',
      }, { status: 200 })
    }

    // Filter out invalid day numbers
    const validDays = postponedDays.filter((d: unknown) => typeof d === 'number' && Number.isInteger(d) && d > 0)
    if (validDays.length !== postponedDays.length) {
      console.warn('[Postpone GET] Found invalid day numbers in postponed_days:', {
        email: email.substring(0, 3) + '***',
        originalCount: postponedDays.length,
        validCount: validDays.length,
      })
    }

    console.info('[Postpone GET] Retrieved postponed days:', {
      email: email.substring(0, 3) + '***',
      count: validDays.length,
    })

    return NextResponse.json({
      postponedDays: validDays,
    }, { status: 200 })
  } catch (error) {
    console.error('[Postpone GET] Unexpected error:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json({
      error: 'Internal server error',
      details: 'An unexpected error occurred while retrieving postponed days',
    }, { status: 500 })
  }
}

// DELETE: Clear a postponed day after completing it
export async function DELETE(request: NextRequest) {
  try {
    // Parse request body
    let email: string
    let day: number
    try {
      const body = await request.json()
      email = body.email
      day = body.day
    } catch (parseError) {
      console.warn('[Postpone DELETE] Invalid JSON:', {
        error: parseError instanceof Error ? parseError.message : String(parseError),
      })
      return NextResponse.json({
        error: 'Invalid request format',
        details: 'Body must be valid JSON with email and day fields',
      }, { status: 400 })
    }

    // Validate email
    if (!email || typeof email !== 'string' || !email.trim()) {
      console.warn('[Postpone DELETE] Missing or invalid email')
      return NextResponse.json({
        error: 'Email is required',
        details: 'Please provide a valid email address',
      }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      console.warn('[Postpone DELETE] Invalid email format')
      return NextResponse.json({
        error: 'Invalid email format',
        details: 'Please provide a valid email address',
      }, { status: 400 })
    }

    // Validate day
    if (day === undefined || day === null) {
      console.warn('[Postpone DELETE] Missing day parameter')
      return NextResponse.json({
        error: 'Day is required',
        details: 'Please specify which day to clear',
      }, { status: 400 })
    }

    if (typeof day !== 'number' || !Number.isInteger(day) || day < 1) {
      console.warn('[Postpone DELETE] Invalid day number:', { day })
      return NextResponse.json({
        error: 'Invalid day number',
        details: 'Day must be a positive integer',
      }, { status: 400 })
    }

    const supabase = getServerClient()

    const { data: subscriber, error: subscriberError } = await supabase
      .from('subscribers')
      .select('postponed_days')
      .eq('email', email.trim())
      .single()

    if (subscriberError && subscriberError.code !== 'PGRST116') {
      console.error('[Postpone DELETE] Subscriber query failed:', {
        email: email.substring(0, 3) + '***',
        error: subscriberError.message,
      })
      return NextResponse.json({
        error: 'Database error',
        details: 'Could not retrieve subscriber information',
      }, { status: 500 })
    }

    if (!subscriber) {
      console.warn('[Postpone DELETE] Subscriber not found:', { email: email.substring(0, 3) + '***' })
      return NextResponse.json({
        error: 'Subscriber not found',
        details: 'Could not find the specified subscriber',
      }, { status: 404 })
    }

    // Check if day is in postponed_days
    const postponedDays = (subscriber.postponed_days || [])
    if (!postponedDays.includes(day)) {
      console.info('[Postpone DELETE] Day not in postponed list:', {
        email: email.substring(0, 3) + '***',
        day,
        postponedDays,
      })
      return NextResponse.json({
        error: 'Day not postponed',
        details: `Day ${day} is not in your postponed list`,
      }, { status: 409 })
    }

    // Remove the day from postponed_days
    const updatedPostponedDays = postponedDays.filter((d: number) => d !== day)

    const { error: updateError } = await supabase
      .from('subscribers')
      .update({ postponed_days: updatedPostponedDays })
      .eq('email', email.trim())

    if (updateError) {
      console.error('[Postpone DELETE] Update failed:', {
        email: email.substring(0, 3) + '***',
        day,
        error: updateError.message,
      })
      return NextResponse.json({
        error: 'Update failed',
        details: 'Could not remove day from postponed list',
      }, { status: 500 })
    }

    console.info('[Postpone DELETE] Day successfully cleared:', {
      email: email.substring(0, 3) + '***',
      day,
    })

    return NextResponse.json({
      success: true,
      message: `Day ${day} 학습 완료!`,
    }, { status: 200 })
  } catch (error) {
    console.error('[Postpone DELETE] Unexpected error:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json({
      error: 'Internal server error',
      details: 'An unexpected error occurred while processing your request',
    }, { status: 500 })
  }
}
