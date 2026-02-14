'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import PandaLogo from '@/components/PandaLogo'

export default function InvitePage() {
  const params = useParams()
  const router = useRouter()
  const code = params.code as string
  const [inviter, setInviter] = useState<{ name: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function checkInvite() {
      try {
        // Use API to find the inviter by invite code
        const res = await fetch(`/api/invite/${encodeURIComponent(code)}`)
        const data = await res.json()

        if (!res.ok || data.error) {
          setError('유효하지 않은 초대 링크입니다')
        } else {
          setInviter(data.inviter)
        }
      } catch {
        setError('초대 링크를 확인하는 중 오류가 발생했습니다')
      }
      setLoading(false)
    }

    if (code) {
      checkInvite()
    }
  }, [code])

  const handleJoin = () => {
    // Redirect to login with referral code
    router.push(`/login?ref=${code}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="animate-pulse text-white">로딩 중...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-6xl mb-4">😅</div>
          <h1 className="text-xl font-bold text-white mb-2">앗!</h1>
          <p className="text-zinc-400 mb-6">{error}</p>
          <button
            onClick={() => router.push('/login')}
            className="px-6 py-3 bg-violet-500 text-white rounded-xl font-medium hover:bg-violet-600 transition-colors"
          >
            로그인 페이지로 이동
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col relative overflow-hidden">
      {/* Background glows */}
      <div className="fixed inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 0% 0%, rgba(139, 92, 246, 0.12) 0%, transparent 50%)' }} />
      <div className="fixed inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 100% 100%, rgba(139, 92, 246, 0.12) 0%, transparent 50%)' }} />

      <main className="flex-1 flex items-center justify-center px-4 py-6 relative z-10">
        <div className="w-full max-w-md text-center">
          {/* Panda Icon */}
          <div className="mb-6"><PandaLogo size={80} variant="excited" /></div>

          {/* Invitation Message */}
          <h1 className="text-2xl font-bold text-white mb-2">
            옛설판다에 초대되셨습니다!
          </h1>
          <p className="text-zinc-400 mb-8">
            <span className="text-violet-400 font-medium">{inviter?.name}</span>님이 비즈니스 영어 학습에 초대했습니다
          </p>

          {/* Features */}
          <div className="card p-6 mb-6 text-left">
            <h2 className="font-bold text-white mb-4">옛설판다와 함께라면</h2>
            <ul className="space-y-3 text-sm text-zinc-400">
              <li className="flex items-start gap-3">
                <span className="text-violet-400">✓</span>
                <span>매일 아침 비즈니스 영어 단어를 배웁니다</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-violet-400">✓</span>
                <span>점심에 퀴즈로 복습하고, 저녁에 리뷰합니다</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-violet-400">✓</span>
                <span>카카오톡, 이메일, 푸시로 알림을 받습니다</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-violet-400">✓</span>
                <span>나만의 진도로 학습을 진행합니다</span>
              </li>
            </ul>
          </div>

          {/* Join Button */}
          <button
            onClick={handleJoin}
            className="w-full h-14 bg-gradient-to-r from-violet-500 to-purple-500 text-white font-bold text-lg rounded-xl hover:opacity-90 active:scale-[0.98] transition-all shadow-lg shadow-violet-500/25"
          >
            지금 시작하기
          </button>

          <p className="text-xs text-zinc-600 mt-4">
            소셜 로그인으로 간편하게 가입할 수 있습니다
          </p>
        </div>
      </main>
    </div>
  )
}
