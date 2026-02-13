import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase'
import { requireAuth, verifyEmailOwnership, sanitizeEmail } from '@/lib/auth-middleware'

// POST /api/my/status - Update user's subscription status
export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const { user } = authResult

  const body = await request.json()
  const { email, status } = body

  const sanitizedEmail = sanitizeEmail(email || user.email)
  if (!sanitizedEmail) return NextResponse.json({ error: 'Valid email required' }, { status: 400 })

  if (!verifyEmailOwnership(user.email, sanitizedEmail)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Validate status
  if (!['active', 'paused'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status. Use "active" or "paused"' }, { status: 400 })
  }

  const supabase = getServerClient()

  const { error } = await supabase
    .from('subscribers')
    .update({ status })
    .eq('email', sanitizedEmail)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, status })
}
