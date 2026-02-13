import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase'

// GET /api/invite/[code] - Get inviter info by invite code
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params

  if (!code || code.length < 4) {
    return NextResponse.json({ error: 'Invalid invite code' }, { status: 400 })
  }

  const supabase = getServerClient()

  // Try to find subscriber by invite_code
  const { data: subscriber, error } = await supabase
    .from('subscribers')
    .select('name, email')
    .eq('invite_code', code.toUpperCase())
    .single()

  if (error) {
    // If invite_code column doesn't exist or no match found,
    // try to match by email prefix (fallback for ALLOFD style codes)
    const { data: allSubscribers, error: listError } = await supabase
      .from('subscribers')
      .select('name, email')

    if (listError || !allSubscribers) {
      return NextResponse.json({ error: 'Invite code not found' }, { status: 404 })
    }

    // Find subscriber whose email starts with the code (case insensitive)
    const matchedSubscriber = allSubscribers.find(s => {
      const emailPrefix = s.email.split('@')[0].substring(0, 6).toUpperCase()
      return emailPrefix === code.toUpperCase()
    })

    if (matchedSubscriber) {
      return NextResponse.json({
        inviter: {
          name: matchedSubscriber.name || '학습자',
        },
        code: code.toUpperCase(),
      })
    }

    return NextResponse.json({ error: 'Invite code not found' }, { status: 404 })
  }

  return NextResponse.json({
    inviter: {
      name: subscriber.name || '학습자',
    },
    code: code.toUpperCase(),
  })
}
