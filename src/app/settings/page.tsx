'use client'

import { useState, useEffect, useCallback } from 'react'
import { createAuthBrowserClient } from '@/lib/supabase-auth'
import {
  isPushNotificationSupported,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  getSubscriptionStatus,
  getNotificationPermission,
} from '@/lib/push-notifications'

interface Settings {
  words_per_day: number
  morning_time: string
  lunch_time: string
  evening_time: string
  timezone: string
  email_enabled: boolean
  kakao_enabled: boolean
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    words_per_day: 10,
    morning_time: '07:30',
    lunch_time: '13:00',
    evening_time: '16:00',
    timezone: 'Asia/Seoul',
    email_enabled: true,
    kakao_enabled: true,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [user, setUser] = useState<{ email: string; name: string } | null>(null)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushSupported, setPushSupported] = useState(false)
  const [togglingPush, setTogglingPush] = useState(false)

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

    // Check push notification support and status
    setPushSupported(isPushNotificationSupported())
    if (isPushNotificationSupported()) {
      const status = await getSubscriptionStatus(authUser.email || '')
      setPushEnabled(status.enabled)
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

  const handleTogglePush = async () => {
    if (!user || togglingPush) return
    setTogglingPush(true)

    try {
      if (pushEnabled) {
        // Disable notifications
        await unsubscribeFromPushNotifications(user.email)
        setPushEnabled(false)
        setToast('알림이 비활성화되었습니다')
      } else {
        // Check permission first
        const permission = getNotificationPermission()
        if (permission === 'denied') {
          setToast('브라우저 알림 권한이 차단되었습니다. 브라우저 설정에서 권한을 허용해주세요.')
          setTimeout(() => setToast(''), 4000)
          setTogglingPush(false)
          return
        }

        // Enable notifications
        await subscribeToPushNotifications(user.email)
        setPushEnabled(true)
        setToast('알림이 활성화되었습니다!')
      }
      setTimeout(() => setToast(''), 2000)
    } catch (error) {
      console.error('Error toggling push notifications:', error)
      setToast(error instanceof Error ? error.message : '알림 설정 중 오류가 발생했습니다')
      setTimeout(() => setToast(''), 3000)
    } finally {
      setTogglingPush(false)
    }
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

      {/* Notification Channels */}
      <div className="card p-6 space-y-5">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="text-violet-400">🔔</span> 알림 채널 설정
        </h2>

        <div className="space-y-3">
          {/* Email Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
            <div className="flex-1">
              <p className="text-sm font-medium text-white flex items-center gap-2">
                <span>📧</span> 이메일 알림
              </p>
              <p className="text-xs text-zinc-500 mt-1">매일 아침 단어, 점심 테스트, 저녁 리뷰를 이메일로 받습니다</p>
            </div>
            <button
              onClick={() => setSettings(s => ({ ...s, email_enabled: !s.email_enabled }))}
              className={`relative w-14 h-8 rounded-full transition-all ${
                settings.email_enabled ? 'bg-emerald-500' : 'bg-zinc-700'
              }`}
            >
              <div
                className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${
                  settings.email_enabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* KakaoTalk Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
            <div className="flex-1">
              <p className="text-sm font-medium text-white flex items-center gap-2">
                <span>💬</span> 카카오톡 알림
              </p>
              <p className="text-xs text-zinc-500 mt-1">카카오톡 채널 메시지로 학습 알림을 받습니다</p>
            </div>
            <button
              onClick={() => setSettings(s => ({ ...s, kakao_enabled: !s.kakao_enabled }))}
              className={`relative w-14 h-8 rounded-full transition-all ${
                settings.kakao_enabled ? 'bg-[#FEE500]' : 'bg-zinc-700'
              }`}
            >
              <div
                className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${
                  settings.kakao_enabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Push Notifications Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
            <div className="flex-1">
              <p className="text-sm font-medium text-white flex items-center gap-2">
                <span>🔔</span> 푸시 알림
              </p>
              <p className="text-xs text-zinc-500 mt-1">브라우저 푸시 알림으로 리마인더를 받습니다</p>
              {!pushSupported && (
                <p className="text-xs text-amber-400 mt-1">이 브라우저는 푸시 알림을 지원하지 않습니다</p>
              )}
            </div>
            <button
              onClick={handleTogglePush}
              disabled={!pushSupported || togglingPush}
              className={`relative w-14 h-8 rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                pushEnabled ? 'bg-emerald-500' : 'bg-zinc-700'
              }`}
            >
              <div
                className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${
                  pushEnabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Info Box */}
        <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20">
          <p className="text-xs text-violet-300 font-medium mb-2">알림 받는 내용</p>
          <ul className="space-y-1.5 text-xs text-zinc-400">
            <li className="flex items-center gap-2">
              <span className="text-violet-400">•</span> 아침: 오늘의 비즈니스 영어 단어
            </li>
            <li className="flex items-center gap-2">
              <span className="text-violet-400">•</span> 점심: 오전 학습 단어 테스트
            </li>
            <li className="flex items-center gap-2">
              <span className="text-violet-400">•</span> 저녁: 하루 학습 요약 리뷰
            </li>
          </ul>
        </div>
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
