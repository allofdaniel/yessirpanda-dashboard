import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NaverUserProfile {
  resultcode: string
  message: string
  response: {
    id: string
    email: string
    nickname: string
    profile_image: string
    name: string
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')
    const isLinking = url.searchParams.get('link') === 'true'
    const customRedirect = url.searchParams.get('redirect')

    const naverClientId = Deno.env.get('NAVER_CLIENT_ID')!
    const naverClientSecret = Deno.env.get('NAVER_CLIENT_SECRET')!
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const dashboardUrl = Deno.env.get('DASHBOARD_URL') || 'https://dashboard-keprojects.vercel.app'
    const functionUrl = `${supabaseUrl}/functions/v1/naver-auth`

    // Determine final redirect URL
    const getRedirectUrl = (success: boolean, errorCode?: string) => {
      if (customRedirect) {
        const redirectUrl = new URL(customRedirect)
        if (!success && errorCode) {
          redirectUrl.searchParams.set('error_code', errorCode)
          redirectUrl.searchParams.set('error_description', errorCode)
        }
        return redirectUrl.toString()
      }
      if (!success && errorCode) {
        return `${dashboardUrl}/login?error=${errorCode}`
      }
      return `${dashboardUrl}/dashboard`
    }

    // Handle OAuth error from Naver
    if (error) {
      console.error('Naver OAuth error:', error)
      return Response.redirect(getRedirectUrl(false, 'naver_oauth_failed'), 302)
    }

    // Step 1: If no code, redirect to Naver OAuth
    if (!code) {
      // Build state with link info if linking
      const stateData = {
        id: crypto.randomUUID(),
        link: isLinking,
        redirect: customRedirect,
      }
      const naverState = btoa(JSON.stringify(stateData))

      const naverAuthUrl = new URL('https://nid.naver.com/oauth2.0/authorize')
      naverAuthUrl.searchParams.set('response_type', 'code')
      naverAuthUrl.searchParams.set('client_id', naverClientId)
      naverAuthUrl.searchParams.set('redirect_uri', functionUrl)
      naverAuthUrl.searchParams.set('state', naverState)

      return Response.redirect(naverAuthUrl.toString(), 302)
    }

    // Parse state to get link info
    let parsedState = { link: false, redirect: null as string | null }
    try {
      if (state) {
        parsedState = JSON.parse(atob(state))
      }
    } catch {
      // State might be just a UUID from old flow, ignore
    }

    const finalIsLinking = isLinking || parsedState.link
    const finalRedirect = customRedirect || parsedState.redirect

    // Helper for final redirect
    const buildFinalRedirect = (success: boolean, errorCode?: string) => {
      if (finalRedirect) {
        const redirectUrl = new URL(finalRedirect)
        if (!success && errorCode) {
          redirectUrl.searchParams.set('error_code', errorCode)
          redirectUrl.searchParams.set('error_description', errorCode)
        }
        return redirectUrl.toString()
      }
      if (!success && errorCode) {
        return `${dashboardUrl}/login?error=${errorCode}`
      }
      return `${dashboardUrl}/dashboard`
    }

    // Step 2: Exchange code for tokens
    const tokenUrl = new URL('https://nid.naver.com/oauth2.0/token')
    tokenUrl.searchParams.set('grant_type', 'authorization_code')
    tokenUrl.searchParams.set('client_id', naverClientId)
    tokenUrl.searchParams.set('client_secret', naverClientSecret)
    tokenUrl.searchParams.set('code', code)
    tokenUrl.searchParams.set('state', state || '')

    const tokenRes = await fetch(tokenUrl.toString(), {
      method: 'GET',
    })
    const tokenData = await tokenRes.json()

    if (tokenData.error) {
      console.error('Naver token error:', tokenData)
      return Response.redirect(buildFinalRedirect(false, 'naver_token_failed'), 302)
    }

    const accessToken = tokenData.access_token

    // Step 3: Get user profile from Naver
    const profileRes = await fetch('https://openapi.naver.com/v1/nid/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    const profileData: NaverUserProfile = await profileRes.json()

    if (profileData.resultcode !== '00') {
      console.error('Naver profile error:', profileData)
      return Response.redirect(buildFinalRedirect(false, 'naver_profile_failed'), 302)
    }

    const naverUser = profileData.response
    const naverEmail = naverUser.email
    const name = naverUser.nickname || naverUser.name || '네이버 사용자'
    const avatarUrl = naverUser.profile_image

    if (!naverEmail) {
      return Response.redirect(buildFinalRedirect(false, 'naver_email_required'), 302)
    }

    // Step 4: Create or update user in Supabase
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // If this is a linking operation, we need to handle differently
    if (finalIsLinking) {
      // For linking, we just verify Naver auth worked and redirect to complete page
      // The link-complete page will handle the actual identity linking
      console.log('Naver linking flow - redirecting to link-complete')

      // Check if this Naver account (by ID) is already linked to another user
      const { data: existingUsers } = await supabase.auth.admin.listUsers()
      const naverLinkedUser = existingUsers?.users?.find(u =>
        u.user_metadata?.naver_id === naverUser.id
      )

      if (naverLinkedUser) {
        // This Naver account is already linked to someone
        return Response.redirect(buildFinalRedirect(false, 'identity_already_exists'), 302)
      }

      // Success - redirect to link-complete with naver_id to save
      const successUrl = new URL(finalRedirect || `${dashboardUrl}/auth/link-complete?provider=naver`)
      successUrl.searchParams.set('naver_id', naverUser.id)
      successUrl.searchParams.set('naver_name', name)
      return Response.redirect(successUrl.toString(), 302)
    }

    // Normal login flow (not linking)
    // Check if user exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === naverEmail)

    let userId: string

    if (existingUser) {
      // Update existing user metadata
      userId = existingUser.id
      await supabase.auth.admin.updateUserById(userId, {
        user_metadata: {
          full_name: name,
          avatar_url: avatarUrl,
          provider: 'naver',
          naver_id: naverUser.id,
        },
      })
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: naverEmail,
        email_confirm: true,
        user_metadata: {
          full_name: name,
          avatar_url: avatarUrl,
          provider: 'naver',
          naver_id: naverUser.id,
        },
      })

      if (createError) {
        console.error('User creation error:', createError)
        return Response.redirect(buildFinalRedirect(false, 'user_creation_failed'), 302)
      }

      userId = newUser.user.id

      // Also add to subscribers table
      await supabase.from('subscribers').upsert({
        email: naverEmail,
        name,
        status: 'active',
        created_at: new Date().toISOString(),
      }, { onConflict: 'email' })
    }

    // Step 5: Generate a magic link for the user to sign in
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: naverEmail,
      options: {
        redirectTo: `${dashboardUrl}/dashboard`,
      },
    })

    if (linkError) {
      console.error('Magic link error:', linkError)
      return Response.redirect(buildFinalRedirect(false, 'link_generation_failed'), 302)
    }

    // Extract the token from the magic link and redirect
    const magicLinkUrl = new URL(linkData.properties.action_link)
    const token = magicLinkUrl.searchParams.get('token')
    const tokenType = magicLinkUrl.searchParams.get('type')

    // Redirect to auth callback with the token
    const callbackUrl = `${dashboardUrl}/auth/callback?token=${token}&type=${tokenType}`
    return Response.redirect(callbackUrl, 302)

  } catch (error) {
    console.error('Naver auth error:', error)
    const dashboardUrl = Deno.env.get('DASHBOARD_URL') || 'https://dashboard-keprojects.vercel.app'
    // Try to get redirect from URL if available
    try {
      const url = new URL(req.url)
      const customRedirect = url.searchParams.get('redirect')
      if (customRedirect) {
        const redirectUrl = new URL(customRedirect)
        redirectUrl.searchParams.set('error_code', 'naver_auth_error')
        return Response.redirect(redirectUrl.toString(), 302)
      }
    } catch {
      // Ignore
    }
    return Response.redirect(`${dashboardUrl}/login?error=naver_auth_error`, 302)
  }
})
