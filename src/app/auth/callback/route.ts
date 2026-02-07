import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // Server Component
            }
          },
        },
      }
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // Get user info from OAuth provider
      const user = data.user
      const provider = user.app_metadata?.provider
      const email = user.email

      // Create or update subscriber record
      if (email) {
        const { data: existingSub } = await supabase
          .from('subscribers')
          .select('id')
          .eq('email', email)
          .single()

        if (!existingSub) {
          // Create new subscriber
          await supabase.from('subscribers').insert({
            email,
            name: user.user_metadata?.full_name || user.user_metadata?.name || '학습자',
            status: 'active',
            channels: [provider], // Track which channels they signed up with
          })
        } else {
          // Update channels array
          try {
            await supabase.rpc('add_channel_to_subscriber', {
              subscriber_email: email,
              new_channel: provider,
            })
          } catch {
            // If RPC doesn't exist, just skip
          }
        }

        // If Kakao login, link to kakao_users for chatbot
        if (provider === 'kakao' && user.user_metadata?.provider_id) {
          await supabase.from('kakao_users').upsert({
            kakao_user_id: user.user_metadata.provider_id,
            email,
            name: user.user_metadata?.full_name || user.user_metadata?.name || '학습자',
            last_active: new Date().toISOString(),
          }, { onConflict: 'kakao_user_id' })
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
