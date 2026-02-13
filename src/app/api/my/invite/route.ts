import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase'
import { requireAuth, verifyEmailOwnership, sanitizeEmail } from '@/lib/auth-middleware'

// GET /api/my/invite - Get or generate user's invite code
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult
    const { user } = authResult

    const emailParam = request.nextUrl.searchParams.get('email')
    const email = sanitizeEmail(emailParam || user.email)

    if (!email) return NextResponse.json({ error: 'Valid email required' }, { status: 400 })

    if (!verifyEmailOwnership(user.email, email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
    return NextResponse.json({ invite_code: null, error: 'Failed to get invite code' }, { status: 200 })
  }
}
