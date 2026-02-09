import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams, origin } = new URL(request.url)
    const token = searchParams.get('token')
    const type = searchParams.get('type')
    const next = searchParams.get('next') ?? '/dashboard'

    if (!token || !type) {
      console.warn('[Auth Verify] Missing token or type')
      return NextResponse.redirect(`${origin}/login?error=missing_token`)
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error('[Auth Verify] Missing Supabase configuration')
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
              console.warn('[Auth Verify] Cookie setting error:', {
                error: cookieError instanceof Error ? cookieError.message : String(cookieError),
              })
            }
          },
        },
      }
    )

    // Verify the OTP token
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: type as 'magiclink' | 'email',
    })

    if (verifyError) {
      console.error('[Auth Verify] Token verification failed:', {
        error: verifyError.message,
      })
      return NextResponse.redirect(`${origin}/login?error=verification_failed`)
    }

    if (!data?.user) {
      console.error('[Auth Verify] No user returned from verification')
      return NextResponse.redirect(`${origin}/login?error=no_user`)
    }

    console.info('[Auth Verify] Verification successful:', {
      email: data.user.email,
      provider: data.user.user_metadata?.provider || 'naver',
    })

    return NextResponse.redirect(`${origin}${next}`)
  } catch (error) {
    console.error('[Auth Verify] Unexpected error:', {
      error: error instanceof Error ? error.message : String(error),
    })
    const { origin } = new URL(request.url)
    return NextResponse.redirect(`${origin}/login?error=unexpected`)
  }
}
