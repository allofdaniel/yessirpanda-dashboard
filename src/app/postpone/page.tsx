'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useEffect, Suspense } from 'react'

function PostponeContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  const email = searchParams.get('email')
  const day = searchParams.get('day')

  useEffect(() => {
    if (!email || !day) {
      setStatus('error')
      setMessage('잘못된 요청입니다.')
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
      <div className="w-full max-w-md rounded-xl p-8 text-center"
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}>

        {status === 'loading' && (
          <>
            <div className="text-5xl mb-4 animate-bounce">🐼</div>
            <h1 className="text-white text-xl font-bold mb-2">처리 중...</h1>
            <p className="text-zinc-500">잠시만 기다려주세요</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="text-5xl mb-4">✅</div>
            <h1 className="text-white text-xl font-bold mb-2">내일로 미뤄졌어요!</h1>
            <p className="text-zinc-400 mb-6">{message}</p>
            <p className="text-zinc-500 text-sm mb-4">
              내일 다시 같은 단어를 받아보실 수 있어요.<br/>
              오늘 하루도 화이팅하세요! 💪
            </p>
            <button
              onClick={() => router.push('/')}
              className="bg-violet-600 hover:bg-violet-700 text-white font-medium px-6 py-2 rounded-lg transition-colors"
            >
              대시보드로 이동
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-5xl mb-4">😢</div>
            <h1 className="text-white text-xl font-bold mb-2">오류 발생</h1>
            <p className="text-zinc-400 mb-6">{message}</p>
            <button
              onClick={() => router.push('/login')}
              className="bg-zinc-700 hover:bg-zinc-600 text-white font-medium px-6 py-2 rounded-lg transition-colors"
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
        <div className="text-5xl animate-bounce">🐼</div>
      </div>
    }>
      <PostponeContent />
    </Suspense>
  )
}
