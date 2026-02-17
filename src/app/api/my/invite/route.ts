import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase'
import { requireAuth, verifyEmailOwnership, sanitizeEmail } from '@/lib/auth-middleware'
import { apiError } from '@/lib/api-contract'
import { checkRateLimit, responseRateLimited } from '@/lib/request-policy'

// GET /api/my/invite - Get or generate user's invite code
export async function GET(request: NextRequest) {
  try {
    const rate = checkRateLimit('api:my:invite', request, {
      maxRequests: 120,
      windowMs: 60_000,
    })
    if (!rate.allowed) {
      return responseRateLimited(rate.retryAfter || 1, 'api:my:invite')
    }

    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return apiError('UNAUTHORIZED', 'Authentication required')
    const { user } = authResult

    const emailParam = request.nextUrl.searchParams.get('email')
    const email = sanitizeEmail(emailParam || user.email)

    if (!email) return apiError('INVALID_INPUT', 'Valid email required')

    if (!verifyEmailOwnership(user.email, email)) {
      return apiError('FORBIDDEN', 'You can only access your own invite code')
    }

    const supabase = getServerClient()

    // Get existing invite code (handle case where column might not exist)
    const { data: subscriber, error } = await supabase
      .from('subscribers')
      .select('invite_code')
      .eq('email', email)
      .single()

    // If column doesn't exist or other schema error, generate code from email
    if (error) {
      if (error.code === 'PGRST116') {
        // User not found - return null invite code
        return NextResponse.json({ invite_code: null })
      }
      // For other errors (including missing column), generate a deterministic code
      const fallbackCode = email.split('@')[0].substring(0, 6).toUpperCase()
      return NextResponse.json({ invite_code: fallbackCode })
    }

    // If no invite code, generate one
    if (!subscriber?.invite_code) {
      const newCode = Math.random().toString(36).substring(2, 8).toUpperCase()

      const { error: updateError } = await supabase
        .from('subscribers')
        .update({ invite_code: newCode })
        .eq('email', email)

      if (updateError) {
        // If update fails, return a deterministic code from email
        const fallbackCode = email.split('@')[0].substring(0, 6).toUpperCase()
        return NextResponse.json({ invite_code: fallbackCode })
      }

      return NextResponse.json({ invite_code: newCode })
    }

    return NextResponse.json({ invite_code: subscriber.invite_code })
  } catch (err) {
    console.error('Invite API error:', err)
    return apiError(
      'DEPENDENCY_ERROR',
      'Failed to get invite code',
      process.env.NODE_ENV === 'development'
        ? { details: err instanceof Error ? err.message : String(err) }
        : undefined,
    )
  }
}

