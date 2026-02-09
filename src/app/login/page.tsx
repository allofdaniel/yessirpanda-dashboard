'use client'

import { useState } from 'react'
import { createAuthBrowserClient } from '@/lib/supabase-auth'

export default function LoginPage() {
  const [snsLoading, setSnsLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const supabase = createAuthBrowserClient()

  const handleSNSLogin = async (provider: 'kakao' | 'google' | 'github') => {
    setSnsLoading(provider)
    setError('')

    const providerLabel = {
      kakao: '카카오',
      google: 'Google',
      github: 'GitHub',
    }[provider]

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
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

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col relative overflow-hidden">
      {/* Background glows */}
      <div className="fixed inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 0% 0%, rgba(139, 92, 246, 0.12) 0%, transparent 50%)' }} />
      <div className="fixed inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 100% 100%, rgba(139, 92, 246, 0.12) 0%, transparent 50%)' }} />

      {/* Header */}
      <header className="relative z-10 w-full px-4 py-4 sm:px-6 sm:py-6 lg:px-20 flex items-center">
        <div className="flex items-center gap-2">
          <span className="text-xl sm:text-2xl">🐼</span>
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
            <div className="text-4xl sm:text-5xl mb-2 sm:mb-3">🐼</div>
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
              카카오 로그인 / 회원가입
            </div>

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
