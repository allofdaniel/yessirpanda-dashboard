import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase'
import { requireAuth, verifyEmailOwnership, sanitizeEmail } from '@/lib/auth-middleware'

export async function POST(request: NextRequest) {
  // Require authentication
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const { user } = authResult

  const { email, word, mastered } = await request.json()

  const sanitizedEmail = sanitizeEmail(email)
  if (!sanitizedEmail || !word) {
    return NextResponse.json({ error: 'Valid email and word required' }, { status: 400 })
  }

  // Verify user can only update their own mastered words
  if (!verifyEmailOwnership(user.email, sanitizedEmail)) {
    return NextResponse.json({ error: 'Forbidden', message: 'You can only update your own words' }, { status: 403 })
  }

  const supabase = getServerClient()
  const { error } = await supabase
    .from('wrong_words')
    .update({ mastered: !!mastered })
    .eq('email', sanitizedEmail)
    .eq('word', word)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
