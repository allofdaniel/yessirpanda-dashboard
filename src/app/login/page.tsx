'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createAuthBrowserClient } from '@/lib/supabase-auth'

// Error message mapping for better UX
const getErrorMessage = (error: string | null, provider?: string): string => {
  if (!error) return ''

  const errorLower = error.toLowerCase()

  if (provider) {
    return `${provider} 로그인에 실패했습니다. 다시 시도해주세요.`
  }

  if (errorLower.includes('invalid') || errorLower.includes('incorrect')) {
    return '이메일 또는 비밀번호가 올바르지 않습니다.'
  }
  if (errorLower.includes('not confirmed')) {
    return '이메일 인증을 완료해주세요.'
  }
  if (errorLower.includes('user_not_found')) {
    return '등록되지 않은 이메일입니다.'
  }
  if (errorLower.includes('network') || errorLower.includes('timeout')) {
    return '네트워크 연결을 확인해주세요.'
  }

  return '로그인에 실패했습니다. 다시 시도해주세요.'
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [snsLoading, setSnsLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createAuthBrowserClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Validate inputs
    if (!email || !password) {
      setError('이메일과 비밀번호를 입력해주세요.')
      setLoading(false)
      return
    }

    if (!email.includes('@')) {
      setError('유효한 이메일 주소를 입력해주세요.')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(getErrorMessage(error.message))
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  const handleSNSLogin = async (provider: 'kakao' | 'google' | 'apple' | 'github') => {
    setSnsLoading(provider)
    setError('')

    const providerLabel = {
      kakao: '카카오',
      google: 'Google',
      github: 'GitHub',
      apple: 'Apple',
    }[provider]

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: provider === 'kakao' ? {
            // Request additional scopes for KakaoTalk channel
            scope: 'profile_nickname profile_image account_email talk_message',
          } : undefined,
        },
      })

      if (error) {
        setError(getErrorMessage(error.message, providerLabel))
        setSnsLoading(null)
      }
    } catch (err) {
      setError(`${providerLabel} 로그인 중 오류가 발생했습니다. 다시 시도해주세요.`)
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
              소셜 로그인 / 회원가입
            </div>

            <button
              onClick={() => handleSNSLogin('kakao')}
              disabled={snsLoading !== null || loading}
              className="w-full h-11 sm:h-12 bg-[#FEE500] text-[#191919] font-bold text-xs sm:text-sm rounded-lg hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
              aria-label="카카오로 시작하기"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="sm:w-5 sm:h-5">
                <path d="M12 3C6.477 3 2 6.477 2 10.5c0 2.47 1.607 4.647 4.041 5.902-.127.47-.82 3.03-.853 3.227 0 0-.017.134.07.186.087.052.19.012.19.012.25-.035 2.9-1.9 3.36-2.22.39.054.79.082 1.192.082 5.523 0 10-3.477 10-7.5S17.523 3 12 3"/>
              </svg>
              {snsLoading === 'kakao' ? '연결 중...' : '카카오로 시작하기'}
            </button>

            <button
              onClick={() => handleSNSLogin('google')}
              disabled={snsLoading !== null || loading}
              className="w-full h-11 sm:h-12 bg-white text-gray-700 font-bold text-xs sm:text-sm rounded-lg hover:bg-gray-50 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-gray-200 shadow-md hover:shadow-lg"
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

            <button
              onClick={() => handleSNSLogin('github')}
              disabled={snsLoading !== null || loading}
              className="w-full h-11 sm:h-12 bg-[#24292e] text-white font-bold text-xs sm:text-sm rounded-lg hover:bg-[#2f363d] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
              aria-label="GitHub로 시작하기"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="sm:w-5 sm:h-5">
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
              </svg>
              {snsLoading === 'github' ? '연결 중...' : 'GitHub로 시작하기'}
            </button>
          </div>

          {/* Divider */}
          <div className="relative my-5 sm:my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-xs sm:text-sm">
              <span className="px-4 bg-[rgba(9,9,11,0.8)] text-zinc-500">또는 이메일로 로그인</span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 sm:mb-5 p-3 sm:p-4 rounded-lg bg-red-500/10 border border-red-500/20 animate-in fade-in">
              <p className="text-red-400 text-xs sm:text-sm text-center flex items-start gap-2">
                <span className="text-base flex-shrink-0 mt-0.5">⚠️</span>
                <span className="flex-1">{error}</span>
              </p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5">
            <div className="space-y-1.5">
              <label className="block text-zinc-400 text-xs sm:text-sm font-medium px-1">이메일</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="example@email.com"
                disabled={loading || snsLoading !== null}
                required
                autoComplete="email"
                className="w-full bg-[#121214] border border-white/10 rounded-lg h-11 sm:h-12 px-4 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-zinc-400 text-xs sm:text-sm font-medium px-1">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading || snsLoading !== null}
                required
                autoComplete="current-password"
                className="w-full bg-[#121214] border border-white/10 rounded-lg h-11 sm:h-12 px-4 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <button
              type="submit"
              disabled={loading || snsLoading !== null}
              className="w-full h-11 sm:h-12 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-sm rounded-lg hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-4 sm:mt-2 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            >
              {loading && (
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-4 sm:p-6 text-center relative z-10">
        <p className="text-zinc-700 text-xs">© 2026 옛설판다 Business English</p>
      </footer>
    </div>
  )
}
