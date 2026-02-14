'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useEffect, Suspense } from 'react'
import PandaLogo from '@/components/PandaLogo'

function PostponeContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const email = searchParams.get('email')
  const day = searchParams.get('day')

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(() => {
    if (!email || !day) {
      return 'error'
    }
    return 'loading'
  })
  const [message, setMessage] = useState(() => {
    if (!email || !day) {
      return '잘못된 요청입니다.'
    }
    return ''
  })

  useEffect(() => {
    if (!email || !day) {
      return
    }

    const postpone = async () => {
      try {
        const res = await fetch('/api/postpone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, day: parseInt(day) }),
        })

        const data = await res.json()

        if (res.ok) {
          setStatus('success')
          setMessage(data.message || `Day ${day} 단어가 내일로 미뤄졌습니다.`)
        } else {
          setStatus('error')
          setMessage(data.error || '미루기에 실패했습니다.')
        }
      } catch {
        setStatus('error')
        setMessage('서버 오류가 발생했습니다.')
      }
    }

    postpone()
  }, [email, day])

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-6">
      <div className="card w-full max-w-md p-8 text-center">
        {status === 'loading' && (
          <>
            <div className="mb-4 animate-bounce" role="status" aria-label="로딩 중"><PandaLogo size={64} variant="thinking" /></div>
            <h1 className="text-white text-xl font-bold mb-2">처리 중...</h1>
            <p className="text-zinc-500" aria-live="polite">잠시만 기다려주세요</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="text-5xl mb-4" role="img" aria-label="성공">✅</div>
            <h1 className="text-white text-xl font-bold mb-2">내일로 미뤄졌어요!</h1>
            <p className="text-zinc-400 mb-6" role="status">{message}</p>
            <p className="text-zinc-500 text-sm mb-4">
              내일 다시 같은 단어를 받아보실 수 있어요.<br/>
              오늘 하루도 화이팅하세요! 💪
            </p>
            <button
              onClick={() => router.push('/')}
              className="btn-accent px-6 py-2.5 rounded-lg"
              aria-label="대시보드로 이동"
            >
              대시보드로 이동
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-5xl mb-4" role="img" aria-label="오류">😢</div>
            <h1 className="text-white text-xl font-bold mb-2">오류 발생</h1>
            <p className="text-zinc-400 mb-6" role="alert">{message}</p>
            <button
              onClick={() => router.push('/login')}
              className="bg-zinc-800 hover:bg-zinc-700 text-white font-medium px-6 py-2.5 rounded-lg transition-all active:scale-95"
              aria-label="로그인 페이지로 이동"
            >
              로그인하기
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function PostponePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4 animate-bounce" role="status" aria-label="로딩 중"><PandaLogo size={64} variant="thinking" /></div>
          <p className="text-zinc-500 text-sm">로딩 중...</p>
        </div>
      </div>
    }>
      <PostponeContent />
    </Suspense>
  )
}
