'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { createAuthBrowserClient } from '@/lib/supabase-auth'
import PandaLogo from '@/components/PandaLogo'

export default function LoginPage() {
  const searchParams = useSearchParams()
  const refCode = searchParams.get('ref')
  const [snsLoading, setSnsLoading] = useState<'kakao' | 'google' | 'github' | 'naver' | null>(null)
  const [error, setError] = useState('')
  const supabase = createAuthBrowserClient()

  // Store referral code in session storage for use after OAuth callback
  useEffect(() => {
    if (refCode) {
      sessionStorage.setItem('referral_code', refCode)
    }
  }, [refCode])

  const handleSNSLogin = async (provider: 'kakao' | 'google' | 'github') => {
    setSnsLoading(provider)
    setError('')

    const providerLabel = {
      kakao: '카카오',
      google: 'Google',
      github: 'GitHub',
    }[provider]

    try {
      // Include referral code in redirect URL if present
      const redirectUrl = refCode
        ? `${window.location.origin}/auth/callback?ref=${encodeURIComponent(refCode)}`
        : `${window.location.origin}/auth/callback`

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl,
          queryParams: provider === 'kakao' ? {
            scope: 'profile_nickname profile_image account_email',
          } : undefined,
        },
      })

      if (error) {
        console.error('OAuth error:', error)
        setError(`${providerLabel} 로그인에 실패했습니다. 잠시 후 다시 시도해주세요.`)
        setSnsLoading(null)
      }
    } catch (err) {
      console.error('OAuth exception:', err)
      setError(`${providerLabel} 로그인 중 오류가 발생했습니다.`)
      setSnsLoading(null)
    }
  }

  const handleNaverLogin = async () => {
    setSnsLoading('naver')
    setError('')

    try {
      // Naver OAuth via Edge Function
      const naverAuthUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/naver-auth`
      window.location.href = naverAuthUrl
    } catch (err) {
      console.error('Naver OAuth exception:', err)
      setError('네이버 로그인 중 오류가 발생했습니다.')
      setSnsLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col relative overflow-hidden">
      {/* Background glows */}
      <div className="fixed inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 0% 0%, rgba(139, 92, 246, 0.12) 0%, transparent 50%)' }} />
      <div className="fixed inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 100% 100%, rgba(139, 92, 246, 0.12) 0%, transparent 50%)' }} />

      {/* Header */}
      <header className="relative z-10 w-full px-4 py-4 sm:px-6 sm:py-6 lg:px-20 flex items-center">
        <div className="flex items-center gap-2">
          <PandaLogo size="lg" />
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">옛설판다</h2>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-4 py-6 sm:px-6 relative z-10">
        <div className="w-full max-w-[440px] rounded-lg sm:rounded-xl p-6 sm:p-8 lg:p-10 shadow-2xl"
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}>
          {/* Brand */}
          <div className="flex flex-col items-center text-center mb-6 sm:mb-8">
            <div className="mb-2 sm:mb-3"><PandaLogo size={64} variant="happy" /></div>
            <h1 className="text-white text-xl sm:text-2xl font-bold tracking-tight mb-1">옛설판다</h1>
            <p className="text-zinc-500 text-xs sm:text-sm px-2">비즈니스 영어의 시작, 옛설판다와 함께하세요</p>
          </div>

          {/* Welcome Message for New Users */}
          <div className="mb-5 sm:mb-6 p-3.5 sm:p-4 rounded-lg bg-violet-500/10 border border-violet-500/20">
            <p className="text-violet-300 text-xs sm:text-sm text-center font-medium">
              ✨ 처음이신가요? 소셜 로그인으로 간편하게 시작하세요!
            </p>
            <p className="text-violet-400/70 text-[10px] sm:text-xs text-center mt-1.5">
              로그인과 회원가입이 동시에 진행됩니다
            </p>
          </div>

          {/* SNS Login Buttons - Prominently Displayed */}
          <div className="space-y-2.5 sm:space-y-3 mb-6 sm:mb-8">
            <div className="text-center text-xs sm:text-sm text-zinc-400 mb-2 sm:mb-3 font-medium">
              소셜 로그인 / 회원가입
            </div>

            {/* Kakao Login */}
            <button
              onClick={() => handleSNSLogin('kakao')}
              disabled={snsLoading !== null}
              className="w-full h-11 sm:h-12 bg-[#FEE500] text-[#191919] font-bold text-xs sm:text-sm rounded-lg hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
              aria-label="카카오로 시작하기"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="sm:w-5 sm:h-5">
                <path d="M12 3C6.477 3 2 6.477 2 10.5c0 2.47 1.607 4.647 4.041 5.902-.127.47-.82 3.03-.853 3.227 0 0-.017.134.07.186.087.052.19.012.19.012.25-.035 2.9-1.9 3.36-2.22.39.054.79.082 1.192.082 5.523 0 10-3.477 10-7.5S17.523 3 12 3"/>
              </svg>
              {snsLoading === 'kakao' ? '연결 중...' : '카카오로 시작하기'}
            </button>

            {/* Google Login */}
            <button
              onClick={() => handleSNSLogin('google')}
              disabled={snsLoading !== null}
              className="w-full h-11 sm:h-12 bg-white text-gray-700 font-bold text-xs sm:text-sm rounded-lg hover:bg-gray-50 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md hover:shadow-lg border border-gray-200"
              aria-label="Google로 시작하기"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" className="sm:w-5 sm:h-5">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {snsLoading === 'google' ? '연결 중...' : 'Google로 시작하기'}
            </button>

            {/* Naver Login */}
            <button
              onClick={() => handleNaverLogin()}
              disabled={snsLoading !== null}
              className="w-full h-11 sm:h-12 bg-[#03C75A] text-white font-bold text-xs sm:text-sm rounded-lg hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
              aria-label="네이버로 시작하기"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="sm:w-5 sm:h-5">
                <path d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727v12.845z"/>
              </svg>
              {snsLoading === 'naver' ? '연결 중...' : '네이버로 시작하기'}
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-3 sm:p-4 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-red-400 text-xs sm:text-sm text-center">
                ⚠️ {error}
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="p-4 sm:p-6 text-center relative z-10">
        <p className="text-zinc-700 text-xs">© 2026 옛설판다 Business English</p>
      </footer>
    </div>
  )
}
