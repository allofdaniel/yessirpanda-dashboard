import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const next = searchParams.get('next') ?? '/'

    // Validate code presence
    if (!code) {
      console.warn('[Auth Callback] Missing authentication code')
      return NextResponse.redirect(`${origin}/login?error=missing_code`)
    }

    // Validate environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error('[Auth Callback] Missing Supabase configuration')
      return NextResponse.redirect(`${origin}/login?error=config_error`)
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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
            } catch (cookieError) {
              // Log cookie setting errors but don't fail the entire flow
              console.warn('[Auth Callback] Cookie setting error:', {
                error: cookieError instanceof Error ? cookieError.message : String(cookieError),
                cookieCount: cookiesToSet.length,
              })
            }
          },
        },
      }
    )

    // Exchange code for session
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      console.error('[Auth Callback] Code exchange failed:', {
        error: exchangeError.message,
        code: exchangeError.status,
      })
      return NextResponse.redirect(`${origin}/login?error=exchange_failed`)
    }

    if (!data?.user) {
      console.error('[Auth Callback] No user returned from code exchange')
      return NextResponse.redirect(`${origin}/login?error=no_user`)
    }

    const user = data.user
    const provider = user.app_metadata?.provider
    const email = user.email

    // Validate email
    if (!email) {
      console.error('[Auth Callback] User has no email:', { userId: user.id, provider })
      return NextResponse.redirect(`${origin}/login?error=no_email`)
    }

    // Validate provider
    if (!provider) {
      console.warn('[Auth Callback] User has no provider info:', { email, userId: user.id })
    }

    try {
      // Create or update subscriber record
      const { data: existingSub, error: selectError } = await supabase
        .from('subscribers')
        .select('id')
        .eq('email', email)
        .single()

      if (selectError && selectError.code !== 'PGRST116') {
        // PGRST116 = no rows returned (expected for new users)
        throw new Error(`Failed to check subscriber: ${selectError.message}`)
      }

      if (!existingSub) {
        // Create new subscriber
        const { error: insertError } = await supabase.from('subscribers').insert({
          email,
          name: user.user_metadata?.full_name || user.user_metadata?.name || '학습자',
          status: 'active',
          channels: [provider], // Track which channels they signed up with
        })

        if (insertError) {
          console.error('[Auth Callback] Failed to create subscriber:', {
            email,
            error: insertError.message,
          })
          // Don't fail auth if subscriber creation fails - user can still login
        } else {
          console.info('[Auth Callback] New subscriber created:', { email, provider })
        }
      } else {
        // Update channels array if needed
        if (provider) {
          try {
            const { error: rpcError } = await supabase.rpc('add_channel_to_subscriber', {
              subscriber_email: email,
              new_channel: provider,
            })
            if (rpcError) {
              // Log but don't fail - RPC might not exist or might fail gracefully
              console.warn('[Auth Callback] RPC update failed (non-critical):', {
                email,
                provider,
                error: rpcError.message,
              })
            } else {
              console.info('[Auth Callback] Subscriber channel updated:', { email, provider })
            }
          } catch (rpcException) {
            console.warn('[Auth Callback] RPC exception (non-critical):', {
              email,
              error: rpcException instanceof Error ? rpcException.message : String(rpcException),
            })
          }
        }
      }

      // If Kakao login, link to kakao_users for chatbot
      if (provider === 'kakao' && user.user_metadata?.provider_id) {
        try {
          const { error: upsertError } = await supabase.from('kakao_users').upsert({
            kakao_user_id: user.user_metadata.provider_id,
            email,
            name: user.user_metadata?.full_name || user.user_metadata?.name || '학습자',
            last_active: new Date().toISOString(),
          }, { onConflict: 'kakao_user_id' })

          if (upsertError) {
            console.warn('[Auth Callback] Failed to upsert Kakao user (non-critical):', {
              kakaoId: user.user_metadata.provider_id,
              email,
              error: upsertError.message,
            })
          } else {
            console.info('[Auth Callback] Kakao user synced:', {
              kakaoId: user.user_metadata.provider_id,
              email,
            })
          }
        } catch (kakaoException) {
          console.warn('[Auth Callback] Kakao sync exception (non-critical):', {
            email,
            error: kakaoException instanceof Error ? kakaoException.message : String(kakaoException),
          })
        }
      }
    } catch (dbError) {
      console.error('[Auth Callback] Database operation failed:', {
        email,
        error: dbError instanceof Error ? dbError.message : String(dbError),
      })
      // Don't fail authentication if database operations fail
      // User should still be able to login
    }

    // Validate redirect URL
    const redirectUrl = `${origin}${next}`
    try {
      new URL(redirectUrl)
    } catch {
      console.warn('[Auth Callback] Invalid redirect URL, using fallback:', { attemptedUrl: redirectUrl })
      return NextResponse.redirect(`${origin}/`)
    }

    console.info('[Auth Callback] Authentication successful:', { email, provider })
    return NextResponse.redirect(redirectUrl)
  } catch (error) {
    console.error('[Auth Callback] Unexpected error:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    const { origin } = new URL(request.url)
    return NextResponse.redirect(`${origin}/login?error=unexpected`)
  }
}
