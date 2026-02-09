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

    const naverClientId = Deno.env.get('NAVER_CLIENT_ID')!
    const naverClientSecret = Deno.env.get('NAVER_CLIENT_SECRET')!
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const dashboardUrl = Deno.env.get('DASHBOARD_URL') || 'https://dashboard-keprojects.vercel.app'
    const functionUrl = `${supabaseUrl}/functions/v1/naver-auth`

    // Handle OAuth error from Naver
    if (error) {
      console.error('Naver OAuth error:', error)
      return Response.redirect(`${dashboardUrl}/login?error=naver_oauth_failed`, 302)
    }

    // Step 1: If no code, redirect to Naver OAuth
    if (!code) {
      const naverState = crypto.randomUUID()
      const naverAuthUrl = new URL('https://nid.naver.com/oauth2.0/authorize')
      naverAuthUrl.searchParams.set('response_type', 'code')
      naverAuthUrl.searchParams.set('client_id', naverClientId)
      naverAuthUrl.searchParams.set('redirect_uri', functionUrl)
      naverAuthUrl.searchParams.set('state', naverState)

      return Response.redirect(naverAuthUrl.toString(), 302)
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
      return Response.redirect(`${dashboardUrl}/login?error=naver_token_failed`, 302)
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
      return Response.redirect(`${dashboardUrl}/login?error=naver_profile_failed`, 302)
    }

    const naverUser = profileData.response
    const email = naverUser.email
    const name = naverUser.nickname || naverUser.name || '네이버 사용자'
    const avatarUrl = naverUser.profile_image

    if (!email) {
      return Response.redirect(`${dashboardUrl}/login?error=naver_email_required`, 302)
    }

    // Step 4: Create or update user in Supabase
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Check if user exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === email)

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
        email,
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
        return Response.redirect(`${dashboardUrl}/login?error=user_creation_failed`, 302)
      }

      userId = newUser.user.id

      // Also add to subscribers table
      await supabase.from('subscribers').upsert({
        email,
        name,
        status: 'active',
        created_at: new Date().toISOString(),
      }, { onConflict: 'email' })
    }

    // Step 5: Generate a magic link for the user to sign in
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo: `${dashboardUrl}/dashboard`,
      },
    })

    if (linkError) {
      console.error('Magic link error:', linkError)
      return Response.redirect(`${dashboardUrl}/login?error=link_generation_failed`, 302)
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
    return Response.redirect(`${dashboardUrl}/login?error=naver_auth_error`, 302)
  }
})
