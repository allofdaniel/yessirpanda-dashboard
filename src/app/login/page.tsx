'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createAuthBrowserClient } from '@/lib/supabase-auth'

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

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.')
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  const handleSNSLogin = async (provider: 'kakao' | 'google' | 'apple' | 'github') => {
    setSnsLoading(provider)
    setError('')

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
      setError(`${provider} 로그인에 실패했습니다.`)
      setSnsLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col relative overflow-hidden">
      {/* Background glows */}
      <div className="fixed inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 0% 0%, rgba(139, 92, 246, 0.12) 0%, transparent 50%)' }} />
      <div className="fixed inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 100% 100%, rgba(139, 92, 246, 0.12) 0%, transparent 50%)' }} />

      {/* Header */}
      <header className="relative z-10 w-full px-6 py-6 lg:px-20 flex items-center">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🐼</span>
          <h2 className="text-xl font-bold text-white tracking-tight">옛설판다</h2>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center p-6 relative z-10">
        <div className="w-full max-w-[440px] rounded-xl p-8 lg:p-10 shadow-2xl"
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}>
          {/* Brand */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="text-5xl mb-3">🐼</div>
            <h1 className="text-white text-2xl font-bold tracking-tight mb-1">옛설판다</h1>
            <p className="text-zinc-500 text-sm">비즈니스 영어의 시작, 옛설판다와 함께하세요</p>
          </div>

          {/* SNS Login Buttons */}
          <div className="space-y-3 mb-6">
            <button
              onClick={() => handleSNSLogin('kakao')}
              disabled={snsLoading !== null}
              className="w-full h-12 bg-[#FEE500] text-[#191919] font-bold text-sm rounded-lg hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3C6.477 3 2 6.477 2 10.5c0 2.47 1.607 4.647 4.041 5.902-.127.47-.82 3.03-.853 3.227 0 0-.017.134.07.186.087.052.19.012.19.012.25-.035 2.9-1.9 3.36-2.22.39.054.79.082 1.192.082 5.523 0 10-3.477 10-7.5S17.523 3 12 3"/>
              </svg>
              {snsLoading === 'kakao' ? '연결 중...' : '카카오로 시작하기'}
            </button>

            <button
              onClick={() => handleSNSLogin('google')}
              disabled={snsLoading !== null}
              className="w-full h-12 bg-white text-gray-700 font-bold text-sm rounded-lg hover:bg-gray-50 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-gray-200"
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {snsLoading === 'google' ? '연결 중...' : 'Google로 시작하기'}
            </button>

            <button
              onClick={() => handleSNSLogin('github')}
              disabled={snsLoading !== null}
              className="w-full h-12 bg-[#24292e] text-white font-bold text-sm rounded-lg hover:bg-[#2f363d] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
              </svg>
              {snsLoading === 'github' ? '연결 중...' : 'GitHub로 시작하기'}
            </button>
          </div>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-transparent text-zinc-500">또는 이메일로 로그인</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-zinc-400 text-sm font-medium px-1">이메일</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="example@email.com"
                required
                className="w-full bg-[#121214] border border-white/10 rounded-lg h-12 px-4 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-zinc-400 text-sm font-medium px-1">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-[#121214] border border-white/10 rounded-lg h-12 px-4 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all text-sm"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || snsLoading !== null}
              className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-sm rounded-lg hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center relative z-10">
        <p className="text-zinc-700 text-xs">© 2026 옛설판다 Business English</p>
      </footer>
    </div>
  )
}
