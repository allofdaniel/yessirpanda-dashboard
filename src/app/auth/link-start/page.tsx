'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createAuthBrowserClient } from '@/lib/supabase-auth'

export default function LinkStartPage() {
  const [status, setStatus] = useState('연동 준비 중...')
  const [error, setError] = useState<string | null>(null)
  const searchParams = useSearchParams()

  useEffect(() => {
    const startLink = async () => {
      const provider = searchParams.get('provider')
      if (!provider) {
        setError('Provider not specified')
        return
      }

      const supabase = createAuthBrowserClient()

      // Check if user is logged in
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('로그인이 필요합니다. 이 창을 닫고 다시 시도해주세요.')
        return
      }

      setStatus(`${provider} 연동 중...`)

      try {
        if (provider === 'naver') {
          window.location.href = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/naver-auth?link=true&redirect=${encodeURIComponent(window.location.origin + '/auth/link-complete?provider=naver')}`
        } else {
          const { error } = await supabase.auth.linkIdentity({
            provider: provider as 'kakao' | 'google',
            options: {
              redirectTo: `${window.location.origin}/auth/link-complete?provider=${provider}`,
              queryParams: provider === 'kakao' ? { scope: 'profile_nickname profile_image account_email' } : undefined,
            },
          })
          if (error) throw error
        }
      } catch (err) {
        console.error('Link error:', err)
        setError('연동 중 오류가 발생했습니다. 창을 닫고 다시 시도해주세요.')
      }
    }

    startLink()
  }, [searchParams])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
        <div className="text-center">
          <div className="text-4xl mb-4">❌</div>
          <h1 className="text-xl font-bold text-white mb-2">오류 발생</h1>
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => window.close()}
            className="px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600"
          >
            창 닫기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
      <div className="text-center">
        <div className="text-4xl mb-4 animate-spin">⏳</div>
        <h1 className="text-xl font-bold text-white mb-2">{status}</h1>
        <p className="text-zinc-400">잠시만 기다려주세요...</p>
      </div>
    </div>
  )
}
