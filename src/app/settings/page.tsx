'use client'

import { useState, useEffect, useCallback } from 'react'
import { createAuthBrowserClient } from '@/lib/supabase-auth'

interface Settings {
  words_per_day: number
  morning_time: string
  lunch_time: string
  evening_time: string
  timezone: string
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    words_per_day: 10,
    morning_time: '07:30',
    lunch_time: '13:00',
    evening_time: '16:00',
    timezone: 'Asia/Seoul',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [user, setUser] = useState<{ email: string; name: string } | null>(null)

  const supabase = createAuthBrowserClient()

  const fetchData = useCallback(async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return
    setUser({ email: authUser.email || '', name: authUser.user_metadata?.name || '학습자' })

    const res = await fetch(`/api/my/settings?email=${encodeURIComponent(authUser.email || '')}`)
    if (res.ok) {
      const data = await res.json()
      if (data.settings) setSettings(data.settings)
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    const res = await fetch('/api/my/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, ...settings }),
    })
    if (res.ok) {
      setToast('설정이 저장되었습니다!')
      setTimeout(() => setToast(''), 2000)
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-white/5 rounded w-40" />
        <div className="h-40 bg-white/5 rounded-2xl" />
        <div className="h-60 bg-white/5 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-white">설정</h1>

      {/* Learning Settings */}
      <div className="card p-6 space-y-5">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="text-violet-400">📚</span> 학습 설정
        </h2>
        <div>
          <label className="block text-sm text-zinc-400 mb-2">하루 학습 단어 수</label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={5}
              max={30}
              step={5}
              value={settings.words_per_day}
              onChange={e => setSettings(s => ({ ...s, words_per_day: parseInt(e.target.value) }))}
              className="flex-1 h-2 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-violet-500"
            />
            <span className="text-xl font-bold text-white w-12 text-right">{settings.words_per_day}</span>
            <span className="text-sm text-zinc-500">개</span>
          </div>
          <div className="flex justify-between text-xs text-zinc-600 mt-1 px-1">
            <span>5</span><span>10</span><span>15</span><span>20</span><span>25</span><span>30</span>
          </div>
        </div>
      </div>

      {/* Email Schedule */}
      <div className="card p-6 space-y-5">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="text-violet-400">📧</span> 이메일 스케줄
        </h2>

        {[
          { label: '아침 학습 메일', key: 'morning_time' as const, desc: '오늘의 비즈니스 단어 발송' },
          { label: '점심 테스트', key: 'lunch_time' as const, desc: '오전 학습 단어 테스트' },
          { label: '저녁 리뷰', key: 'evening_time' as const, desc: '하루 학습 요약 및 Day 진행' },
        ].map((item) => (
          <div key={item.key} className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
            <div>
              <p className="text-sm font-medium text-white">{item.label}</p>
              <p className="text-xs text-zinc-500">{item.desc}</p>
            </div>
            <input
              type="time"
              value={settings[item.key]}
              onChange={e => setSettings(s => ({ ...s, [item.key]: e.target.value }))}
              className="bg-[#121214] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
            />
          </div>
        ))}
      </div>

      {/* Account */}
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="text-violet-400">👤</span> 계정
        </h2>
        <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
          <div>
            <p className="text-sm font-medium text-white">{user?.name}</p>
            <p className="text-xs text-zinc-500">{user?.email}</p>
          </div>
          <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded">Active</span>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-xl hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
      >
        {saving ? '저장 중...' : '설정 저장'}
      </button>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-6 py-3 rounded-xl shadow-lg text-sm font-medium z-50 animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  )
}
