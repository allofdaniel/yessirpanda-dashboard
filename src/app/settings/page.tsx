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

interface LinkedProvider {
  name: string
  id: string
  icon: string
  color: string
  linked: boolean
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
  const [linkedProviders, setLinkedProviders] = useState<LinkedProvider[]>([
    { name: '카카오', id: 'kakao', icon: '💬', color: 'bg-[#FEE500] text-[#191919]', linked: false },
    { name: 'Google', id: 'google', icon: '🔵', color: 'bg-white text-gray-700', linked: false },
    { name: '네이버', id: 'naver', icon: '🟢', color: 'bg-[#03C75A] text-white', linked: false },
  ])
  const [linkingProvider, setLinkingProvider] = useState<string | null>(null)

  const supabase = createAuthBrowserClient()

  const fetchData = useCallback(async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return

    const currentProvider = authUser.app_metadata?.provider || 'email'
    setUser({
      email: authUser.email || '',
      name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || '학습자'
    })

    const res = await fetch(`/api/my/settings?email=${encodeURIComponent(authUser.email || '')}`)
    if (res.ok) {
      const data = await res.json()
      if (data.settings) setSettings(data.settings)
    }

    // Fetch linked channels from subscribers table
    const { data: subscriber } = await supabase
      .from('subscribers')
      .select('channels')
      .eq('email', authUser.email)
      .single()

    const channels = subscriber?.channels || [currentProvider]
    setLinkedProviders(prev => prev.map(p => ({
      ...p,
      linked: channels.includes(p.id)
    })))

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

  const handleLinkProvider = async (providerId: string) => {
    if (linkingProvider) return
    setLinkingProvider(providerId)

    try {
      if (providerId === 'naver') {
        // Naver uses Edge Function
        window.location.href = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/naver-auth?link=true`
      } else {
        // Kakao and Google use Supabase OAuth
        const { error } = await supabase.auth.signInWithOAuth({
          provider: providerId as 'kakao' | 'google',
          options: {
            redirectTo: `${window.location.origin}/auth/callback?next=/settings&link=true`,
            queryParams: providerId === 'kakao' ? {
              scope: 'profile_nickname profile_image account_email',
            } : undefined,
          },
        })
        if (error) throw error
      }
    } catch (error) {
      console.error('Link provider error:', error)
      setToast('연동 중 오류가 발생했습니다')
      setTimeout(() => setToast(''), 3000)
      setLinkingProvider(null)
    }
  }

  const handleUnlinkProvider = async (providerId: string) => {
    const linkedCount = linkedProviders.filter(p => p.linked).length
    if (linkedCount <= 1) {
      setToast('최소 1개의 로그인 방식은 유지해야 합니다')
      setTimeout(() => setToast(''), 3000)
      return
    }

    if (!user) return
    setLinkingProvider(providerId)

    try {
      const { error } = await supabase.rpc('remove_channel_from_subscriber', {
        subscriber_email: user.email,
        channel_to_remove: providerId,
      })

      if (error) {
        // Fallback: direct update
        const { data: subscriber } = await supabase
          .from('subscribers')
          .select('channels')
          .eq('email', user.email)
          .single()

        const newChannels = (subscriber?.channels || []).filter((c: string) => c !== providerId)
        await supabase
          .from('subscribers')
          .update({ channels: newChannels })
          .eq('email', user.email)
      }

      setLinkedProviders(prev => prev.map(p =>
        p.id === providerId ? { ...p, linked: false } : p
      ))
      setToast(`${linkedProviders.find(p => p.id === providerId)?.name} 연동이 해제되었습니다`)
      setTimeout(() => setToast(''), 2000)
    } catch (error) {
      console.error('Unlink provider error:', error)
      setToast('연동 해제 중 오류가 발생했습니다')
      setTimeout(() => setToast(''), 3000)
    } finally {
      setLinkingProvider(null)
    }
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

      {/* SNS Account Linking */}
      <div className="card p-6 space-y-5">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-violet-400">🔗</span> SNS 계정 연동
          </h2>
          <p className="text-xs text-zinc-500 mt-1">여러 SNS로 로그인할 수 있도록 계정을 연동하세요</p>
        </div>

        <div className="space-y-3">
          {linkedProviders.map((provider) => (
            <div
              key={provider.id}
              className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                  provider.id === 'kakao' ? 'bg-[#FEE500]' :
                  provider.id === 'google' ? 'bg-white' :
                  'bg-[#03C75A]'
                }`}>
                  {provider.id === 'kakao' && (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#191919">
                      <path d="M12 3C6.477 3 2 6.477 2 10.5c0 2.47 1.607 4.647 4.041 5.902-.127.47-.82 3.03-.853 3.227 0 0-.017.134.07.186.087.052.19.012.19.012.25-.035 2.9-1.9 3.36-2.22.39.054.79.082 1.192.082 5.523 0 10-3.477 10-7.5S17.523 3 12 3"/>
                    </svg>
                  )}
                  {provider.id === 'google' && (
                    <svg width="20" height="20" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  )}
                  {provider.id === 'naver' && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                      <path d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727v12.845z"/>
                    </svg>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{provider.name}</p>
                  <p className="text-xs text-zinc-500">
                    {provider.linked ? '연동됨' : '연동 안됨'}
                  </p>
                </div>
              </div>

              {provider.linked ? (
                <button
                  onClick={() => handleUnlinkProvider(provider.id)}
                  disabled={linkingProvider === provider.id}
                  className="px-4 py-2 text-xs font-medium text-red-400 bg-red-400/10 rounded-lg hover:bg-red-400/20 transition-colors disabled:opacity-50"
                >
                  {linkingProvider === provider.id ? '처리 중...' : '연동 해제'}
                </button>
              ) : (
                <button
                  onClick={() => handleLinkProvider(provider.id)}
                  disabled={linkingProvider === provider.id}
                  className="px-4 py-2 text-xs font-medium text-violet-400 bg-violet-400/10 rounded-lg hover:bg-violet-400/20 transition-colors disabled:opacity-50"
                >
                  {linkingProvider === provider.id ? '연동 중...' : '연동하기'}
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <p className="text-xs text-amber-300">
            💡 동일한 이메일로 가입된 계정끼리만 연동됩니다. 연동된 SNS 중 하나로 로그인하면 같은 계정으로 접속됩니다.
          </p>
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
