import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  const { email, word, mastered } = await request.json()

  if (!email || !word) {
    return NextResponse.json({ error: 'Email and word required' }, { status: 400 })
  }

  const supabase = getServerClient()
  const { error } = await supabase
    .from('wrong_words')
    .update({ mastered: !!mastered })
    .eq('email', email)
    .eq('word', word)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
