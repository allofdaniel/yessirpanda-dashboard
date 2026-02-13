'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createAuthBrowserClient } from '@/lib/supabase-auth'
import { Suspense } from 'react'

function LinkCompleteContent() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('처리 중...')
  const searchParams = useSearchParams()

  useEffect(() => {
    const handleAuth = async () => {
      const supabase = createAuthBrowserClient()
      const provider = searchParams.get('provider')
      const providerName = provider === 'kakao' ? '카카오' : provider === 'google' ? 'Google' : provider === 'naver' ? '네이버' : provider

      // Check for OAuth error in URL
      const errorCode = searchParams.get('error_code')
      const errorDesc = searchParams.get('error_description')

      if (errorCode) {
        setStatus('error')
        if (errorCode === 'identity_already_exists') {
          setMessage(`이 ${providerName} 계정은 이미 다른 사용자에게 연결되어 있습니다`)
        } else {
          setMessage(errorDesc?.replace(/\+/g, ' ') || '연동 중 오류가 발생했습니다')
        }
        localStorage.setItem('linkComplete', JSON.stringify({ provider, success: false, error: errorCode, time: Date.now() }))
        return
      }

      try {
        // Exchange code for session if present
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const urlParams = new URLSearchParams(window.location.search)

        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        const code = urlParams.get('code')

        if (accessToken && refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
        } else if (code) {
          await supabase.auth.exchangeCodeForSession(code)
        }

        // Handle Naver linking - save naver_id to user metadata
        const naverId = searchParams.get('naver_id')
        const naverName = searchParams.get('naver_name')
        if (provider === 'naver' && naverId) {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            await supabase.auth.updateUser({
              data: {
                ...user.user_metadata,
                naver_id: naverId,
                naver_name: naverName,
              }
            })
          }
        }

        // Notify parent window via localStorage
        localStorage.setItem('linkComplete', JSON.stringify({ provider, success: true, time: Date.now() }))

        setStatus('success')
        setMessage(`${providerName} 연동이 완료되었습니다!`)

        // Close after showing success
        setTimeout(() => {
          window.close()
        }, 1500)
      } catch (err) {
        console.error('Link complete error:', err)
        setStatus('error')
        setMessage('연동 중 오류가 발생했습니다')
        localStorage.setItem('linkComplete', JSON.stringify({ provider, success: false, time: Date.now() }))
      }
    }

    handleAuth()
  }, [searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
      <div className="text-center">
        <div className="text-4xl mb-4">
          {status === 'loading' && <span className="animate-spin inline-block">⏳</span>}
          {status === 'success' && '✅'}
          {status === 'error' && '❌'}
        </div>
        <h1 className="text-xl font-bold text-white mb-2">
          {status === 'loading' && '연동 처리 중...'}
          {status === 'success' && '연동 완료!'}
          {status === 'error' && '오류 발생'}
        </h1>
        <p className={status === 'error' ? 'text-red-400' : 'text-zinc-400'}>{message}</p>
        {status !== 'loading' && (
          <button
            onClick={() => window.close()}
            className="mt-4 px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600"
          >
            창 닫기
          </button>
        )}
      </div>
    </div>
  )
}

export default function LinkCompletePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-spin">⏳</div>
          <p className="text-zinc-400">처리 중...</p>
        </div>
      </div>
    }>
      <LinkCompleteContent />
    </Suspense>
  )
}
