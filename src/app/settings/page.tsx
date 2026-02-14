'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createAuthBrowserClient } from '@/lib/supabase-auth'

interface Settings {
  words_per_day: number
  morning_time: string
  lunch_time: string
  evening_time: string
  timezone: string
  email_enabled: boolean
  sms_enabled: boolean
  kakao_enabled: boolean
  telegram_enabled: boolean
  telegram_chat_id: string
  google_chat_enabled: boolean
  google_chat_webhook: string
  paused: boolean
  active_days: number[]
  phone: string
}

interface SubscriberData {
  invite_code: string
  status: string
  current_day: number
}

interface LinkedProvider {
  name: string
  id: string
  linked: boolean
}

interface Workflow {
  id: string
  name: string
  description: string
  emoji: string
}

function SettingsPageContent() {
  const [settings, setSettings] = useState<Settings>({
    words_per_day: 10,
    morning_time: '07:30',
    lunch_time: '13:00',
    evening_time: '16:00',
    timezone: 'Asia/Seoul',
    email_enabled: true,
    sms_enabled: false,
    kakao_enabled: false,
    telegram_enabled: false,
    telegram_chat_id: '',
    google_chat_enabled: false,
    google_chat_webhook: '',
    paused: false,
    active_days: [1, 2, 3, 4, 5],
    phone: '',
  })
  const [refreshingSettings, setRefreshingSettings] = useState(false)
  const [subscriberData, setSubscriberData] = useState<SubscriberData | null>(null)
  const [inviteCode, setInviteCode] = useState('')
  const [copySuccess, setCopySuccess] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [user, setUser] = useState<{ email: string; name: string } | null>(null)
  const [linkedProviders, setLinkedProviders] = useState<LinkedProvider[]>([
    { name: '카카오', id: 'kakao', linked: false },
    { name: 'Google', id: 'google', linked: false },
    { name: '네이버', id: 'naver', linked: false },
  ])
  const [linkingProvider, setLinkingProvider] = useState<string | null>(null)
  const [triggeringWorkflow, setTriggeringWorkflow] = useState<string | null>(null)
  const [showAdminTools, setShowAdminTools] = useState(false)

  const supabase = createAuthBrowserClient()
  const searchParams = useSearchParams()

  const workflows: Workflow[] = [
    { id: 'morning-words', name: '아침 단어', description: '오늘의 비즈니스 영어 단어 발송', emoji: '🌅' },
    { id: 'lunch-test', name: '점심 테스트', description: '오전 학습 단어 복습 테스트', emoji: '🍽️' },
    { id: 'evening-review', name: '저녁 복습', description: '오늘의 오답 노트 발송', emoji: '🌙' },
  ]

  const fetchData = useCallback(async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return

    const currentProvider = authUser.app_metadata?.provider || 'email'
    setUser({
      email: authUser.email || '',
      name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || '학습자'
    })

    // Fetch settings via API
    const settingsRes = await fetch(`/api/my/settings?email=${encodeURIComponent(authUser.email || '')}`)
    if (settingsRes.ok) {
      const data = await settingsRes.json()
      if (data.settings) setSettings(data.settings)
    }

    // Fetch subscriber data via API
    const progressRes = await fetch(`/api/my/progress?email=${encodeURIComponent(authUser.email || '')}`)
    if (progressRes.ok) {
      const progressData = await progressRes.json()
      setSubscriberData({
        invite_code: '',
        status: progressData.status || 'active',
        current_day: progressData.current_day || 1,
      })
      setSettings(prev => ({
        ...prev,
        paused: progressData.status === 'paused',
      }))
    }

    // Fetch invite code via API
    const inviteRes = await fetch(`/api/my/invite?email=${encodeURIComponent(authUser.email || '')}`)
    if (inviteRes.ok) {
      const inviteData = await inviteRes.json()
      setInviteCode(inviteData.invite_code || '')
    }

    // Get linked providers from auth identities
    const linkedIdentities = authUser.identities?.map(id => id.provider) || [currentProvider]
    // Also check naver_id in user_metadata (custom OAuth)
    const hasNaverId = !!authUser.user_metadata?.naver_id
    setLinkedProviders(prev => prev.map(p => ({
      ...p,
      linked: linkedIdentities.includes(p.id) || (p.id === 'naver' && hasNaverId)
    })))

    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  // Handle linked provider from callback (legacy support)
  useEffect(() => {
    const linkedProvider = searchParams.get('linked')
    if (linkedProvider) {
      const refreshIdentities = async () => {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (authUser) {
          const linkedIdentities = authUser.identities?.map(id => id.provider) || []
          const hasNaverId = !!authUser.user_metadata?.naver_id
          setLinkedProviders(prev => prev.map(p => ({
            ...p,
            linked: linkedIdentities.includes(p.id) || (p.id === 'naver' && hasNaverId)
          })))
          const isLinked = linkedIdentities.includes(linkedProvider) || (linkedProvider === 'naver' && hasNaverId)
          if (isLinked) {
            const providerName = linkedProviders.find(p => p.id === linkedProvider)?.name || linkedProvider
            showToast(`${providerName} 계정이 연동되었습니다!`)
          }
        }
        setLinkingProvider(null)
        window.history.replaceState({}, '', '/settings')
      }
      refreshIdentities()
    }
  }, [searchParams, supabase, linkedProviders])

  const showToast = (message: string) => {
    setToast(message)
    setTimeout(() => setToast(''), 2500)
  }

  const saveSettings = async (settingsToSave: Settings, silent?: boolean) => {
    if (!user) return
    setSaving(true)
    const res = await fetch('/api/my/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, ...settingsToSave }),
    })
    if (res.ok) {
      if (!silent) showToast('설정이 저장되었습니다!')
    } else {
      showToast('설정 저장 실패')
    }
    setSaving(false)
  }

  const handleSave = async () => {
    await saveSettings(settings)
  }

  // Auto-save toggle changes
  const handleToggleChange = async (key: keyof Settings, value: boolean) => {
    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)
    await saveSettings(newSettings, true)
    showToast('설정이 저장되었습니다')
  }

  const handleTogglePause = async () => {
    if (!user) return
    const newPaused = !settings.paused

    const res = await fetch('/api/my/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, status: newPaused ? 'paused' : 'active' }),
    })

    if (res.ok) {
      setSettings(prev => ({ ...prev, paused: newPaused }))
      showToast(newPaused ? '구독이 일시중지되었습니다' : '구독이 재개되었습니다')
    } else {
      showToast('처리 중 오류가 발생했습니다')
    }
  }

  const handleToggleDay = (day: number) => {
    const newDays = settings.active_days.includes(day)
      ? settings.active_days.filter(d => d !== day)
      : [...settings.active_days, day].sort()
    setSettings(prev => ({ ...prev, active_days: newDays }))
  }

  const handleCopyInviteLink = async () => {
    const inviteLink = `${window.location.origin}/invite/${inviteCode}`
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopySuccess(true)
      showToast('초대 링크가 복사되었습니다!')
      setTimeout(() => setCopySuccess(false), 2000)
    } catch {
      showToast('복사 실패. 수동으로 복사해주세요.')
    }
  }

  const handleLinkProvider = async (providerId: string) => {
    if (linkingProvider) return
    setLinkingProvider(providerId)

    try {
      // Open new window for OAuth
      const width = 500
      const height = 650
      const left = window.screenX + (window.outerWidth - width) / 2
      const top = window.screenY + (window.outerHeight - height) / 2

      const linkUrl = `${window.location.origin}/auth/link-start?provider=${providerId}`
      const popup = window.open(
        linkUrl,
        'link-provider',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
      )

      // Listen for localStorage changes from popup
      const handleStorage = (e: StorageEvent) => {
        if (e.key === 'linkComplete' && e.newValue) {
          try {
            const result = JSON.parse(e.newValue)
            if (result.provider === providerId) {
              localStorage.removeItem('linkComplete')
              window.removeEventListener('storage', handleStorage)

              // Refresh user identities
              refreshLinkedProviders(providerId, result.success)
            }
          } catch (err) {
            console.error('Parse error:', err)
          }
        }
      }
      window.addEventListener('storage', handleStorage)

      // Also poll for popup close (backup)
      const checkPopup = setInterval(async () => {
        if (!popup || popup.closed) {
          clearInterval(checkPopup)
          window.removeEventListener('storage', handleStorage)

          // Check localStorage in case storage event didn't fire
          const stored = localStorage.getItem('linkComplete')
          if (stored) {
            try {
              const result = JSON.parse(stored)
              if (result.provider === providerId) {
                localStorage.removeItem('linkComplete')
                refreshLinkedProviders(providerId, result.success)
                return
              }
            } catch (err) {
              console.error('Parse error:', err)
            }
          }

          // Fallback: refresh anyway
          await refreshLinkedProviders(providerId, null)
        }
      }, 500)

    } catch (err) {
      console.error('Link provider error:', err)
      showToast('연동 중 오류가 발생했습니다')
      setLinkingProvider(null)
    }
  }

  const refreshLinkedProviders = async (providerId: string, success: boolean | null) => {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (authUser) {
      const linkedIdentities = authUser.identities?.map(id => id.provider) || []
      const hasNaverId = !!authUser.user_metadata?.naver_id
      const wasLinked = linkedProviders.find(p => p.id === providerId)?.linked
      const nowLinked = linkedIdentities.includes(providerId) || (providerId === 'naver' && hasNaverId)

      setLinkedProviders(prev => prev.map(p => ({
        ...p,
        linked: linkedIdentities.includes(p.id) || (p.id === 'naver' && hasNaverId)
      })))

      if (success === true || (!wasLinked && nowLinked)) {
        const providerName = linkedProviders.find(p => p.id === providerId)?.name || providerId
        showToast(`${providerName} 계정이 연동되었습니다!`)
      } else if (success === false) {
        showToast('연동 중 오류가 발생했습니다')
      }
    }
    setLinkingProvider(null)
  }

  const handleUnlinkProvider = async (providerId: string) => {
    const linkedCount = linkedProviders.filter(p => p.linked).length
    if (linkedCount <= 1) {
      showToast('최소 1개의 로그인 방식은 유지해야 합니다')
      return
    }

    try {
      // Get current user to find the identity to unlink
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        showToast('사용자 정보를 찾을 수 없습니다')
        return
      }

      // Handle Naver unlinking separately (stored in user_metadata)
      if (providerId === 'naver') {
        if (!user.user_metadata?.naver_id) {
          showToast('이 계정은 연동되어 있지 않습니다')
          return
        }
        // Remove naver_id from user_metadata
        const { naver_id, naver_name, ...restMetadata } = user.user_metadata
        const { error } = await supabase.auth.updateUser({
          data: restMetadata
        })
        if (error) {
          console.error('Unlink naver error:', error)
          showToast('연동 해제 중 오류가 발생했습니다')
          return
        }
        setLinkedProviders(prev => prev.map(p =>
          p.id === providerId ? { ...p, linked: false } : p
        ))
        showToast(`${linkedProviders.find(p => p.id === providerId)?.name} 연동이 해제되었습니다`)
        return
      }

      // Find the identity for this provider
      const identity = user.identities?.find(id => id.provider === providerId)
      if (!identity) {
        showToast('이 계정은 연동되어 있지 않습니다')
        return
      }

      // Unlink the identity
      const { error } = await supabase.auth.unlinkIdentity(identity)
      if (error) {
        console.error('Unlink error:', error)
        showToast('연동 해제 중 오류가 발생했습니다')
        return
      }

      setLinkedProviders(prev => prev.map(p =>
        p.id === providerId ? { ...p, linked: false } : p
      ))
      showToast(`${linkedProviders.find(p => p.id === providerId)?.name} 연동이 해제되었습니다`)
    } catch (err) {
      console.error('Unlink provider error:', err)
      showToast('연동 해제 중 오류가 발생했습니다')
    }
  }

  const handleRefreshSettings = async () => {
    if (!user || refreshingSettings) return
    setRefreshingSettings(true)

    try {
      const settingsRes = await fetch(`/api/my/settings?email=${encodeURIComponent(user.email)}`)
      if (settingsRes.ok) {
        const data = await settingsRes.json()
        if (data.settings) {
          setSettings(prev => ({ ...prev, ...data.settings }))
          showToast('설정이 새로고침되었습니다')
        }
      }
    } catch {
      showToast('새로고침 실패')
    } finally {
      setRefreshingSettings(false)
    }
  }

  const handleTriggerWorkflow = async (workflowId: string) => {
    setTriggeringWorkflow(workflowId)
    try {
      const res = await fetch('/api/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow: workflowId }),
      })
      if (res.ok) {
        showToast('워크플로우가 실행되었습니다')
      } else {
        const data = await res.json()
        showToast(data.error || '실행 실패')
      }
    } catch {
      showToast('워크플로우 실행 실패')
    } finally {
      setTriggeringWorkflow(null)
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

      {/* Subscription Status */}
      <div className={`card p-6 ${settings.paused ? 'border-amber-500/30 bg-amber-500/5' : ''}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${settings.paused ? 'bg-amber-500/20' : 'bg-emerald-500/20'}`}>
              {settings.paused ? '⏸️' : '▶️'}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {settings.paused ? '구독 일시중지됨' : '학습 진행 중'}
              </h2>
              <p className="text-xs text-zinc-500">
                {settings.paused ? '메시지가 발송되지 않습니다' : `Day ${subscriberData?.current_day || 1} 진행 중`}
              </p>
            </div>
          </div>
          <button
            onClick={handleTogglePause}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              settings.paused ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
            }`}
          >
            {settings.paused ? '재개하기' : '일시중지'}
          </button>
        </div>
      </div>

      {/* Learning Settings */}
      <div className="card p-6 space-y-5">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="text-violet-400">📚</span> 학습 설정
        </h2>
        <div>
          <label className="block text-sm text-zinc-400 mb-2">하루 학습 단어 수</label>
          <div className="flex items-center gap-4">
            <input
              type="range" min={5} max={30} step={5}
              value={settings.words_per_day}
              onChange={e => setSettings(s => ({ ...s, words_per_day: parseInt(e.target.value) }))}
              className="flex-1 h-2 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-violet-500"
            />
            <span className="text-xl font-bold text-white w-12 text-right">{settings.words_per_day}</span>
            <span className="text-sm text-zinc-500">개</span>
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
              type="time" value={settings[item.key]}
              onChange={e => setSettings(s => ({ ...s, [item.key]: e.target.value }))}
              className="bg-[#121214] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
            />
          </div>
        ))}
        <div className="pt-4 border-t border-white/5">
          <label className="block text-sm text-zinc-400 mb-3">발송 요일 선택</label>
          <div className="flex gap-2">
            {['일', '월', '화', '수', '목', '금', '토'].map((day, idx) => (
              <button
                key={idx} onClick={() => handleToggleDay(idx)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  settings.active_days.includes(idx) ? 'bg-violet-500 text-white' : 'bg-white/5 text-zinc-500 hover:bg-white/10'
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Notification Channels */}
      <div className="card p-6 space-y-5">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="text-violet-400">🔔</span> 알림 채널 설정
        </h2>
        <div className="space-y-3">
          {/* Email Notification */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
            <div className="flex-1">
              <p className="text-sm font-medium text-white flex items-center gap-2">
                <span>📧</span> 이메일 알림
              </p>
              <p className="text-xs text-zinc-500 mt-1">매일 아침 단어, 점심 테스트, 저녁 리뷰를 이메일로 받습니다</p>
              <p className="text-xs text-violet-400 mt-1">→ {user?.email}</p>
            </div>
            <button
              onClick={() => handleToggleChange('email_enabled', !settings.email_enabled)}
              className={`relative w-14 h-8 rounded-full transition-all ${settings.email_enabled ? 'bg-emerald-500' : 'bg-zinc-700'}`}
            >
              <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${settings.email_enabled ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>

          {/* SMS Notification */}
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-white flex items-center gap-2">
                  <span>📱</span> 문자 알림 (SMS)
                </p>
                <p className="text-xs text-zinc-500 mt-1">문자 메시지로 학습 알림을 받습니다</p>
                {settings.phone && settings.phone.length >= 10 ? (
                  <p className="text-xs text-emerald-400 mt-1">→ {settings.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')}</p>
                ) : (
                  <p className="text-xs text-amber-400 mt-1">→ 전화번호를 등록해주세요</p>
                )}
              </div>
              <button
                onClick={() => handleToggleChange('sms_enabled', !settings.sms_enabled)}
                disabled={!settings.phone || settings.phone.length < 10}
                className={`relative w-14 h-8 rounded-full transition-all ${
                  !settings.phone || settings.phone.length < 10 ? 'bg-zinc-700 cursor-not-allowed opacity-50' :
                  settings.sms_enabled ? 'bg-emerald-500' : 'bg-zinc-700'
                }`}
              >
                <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${settings.sms_enabled && settings.phone && settings.phone.length >= 10 ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>
            {(!settings.phone || settings.phone.length < 10) && (
              <div className="pt-3 border-t border-white/5">
                <label className="block text-xs text-zinc-400 mb-2">전화번호 등록 (숫자만 입력)</label>
                <input
                  type="tel"
                  placeholder="01012345678"
                  maxLength={11}
                  value={settings.phone}
                  onChange={e => setSettings(s => ({ ...s, phone: e.target.value.replace(/[^0-9]/g, '').slice(0, 11) }))}
                  className="w-full bg-[#121214] border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                />
                {settings.phone && settings.phone.length > 0 && settings.phone.length < 10 && (
                  <p className="text-xs text-amber-400 mt-2">{settings.phone.length}/11 자리 입력됨</p>
                )}
              </div>
            )}
            {settings.phone && settings.phone.length >= 10 && (
              <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                <p className="text-xs text-zinc-500">전화번호 변경</p>
                <button
                  onClick={async () => {
                    const newSettings = { ...settings, phone: '', sms_enabled: false }
                    setSettings(newSettings)
                    await saveSettings(newSettings, true)
                    showToast('전화번호가 삭제되었습니다')
                  }}
                  className="text-xs text-zinc-400 hover:text-zinc-300"
                >
                  변경하기
                </button>
              </div>
            )}
          </div>

          {/* KakaoTalk Notification - Currently Unavailable */}
          <div className="p-4 rounded-xl bg-white/[0.02] border border-zinc-700/50 opacity-60">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                  <span>💬</span> 카카오톡 알림
                  <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">준비 중</span>
                </p>
                <p className="text-xs text-zinc-500 mt-1">카카오톡 알림톡은 현재 준비 중입니다</p>
                <p className="text-xs text-zinc-600 mt-1">→ 사업자 등록 후 서비스 예정</p>
              </div>
              <button
                disabled
                className="relative w-14 h-8 rounded-full transition-all bg-zinc-700 cursor-not-allowed"
              >
                <div className="absolute top-1 left-1 w-6 h-6 bg-zinc-500 rounded-full" />
              </button>
            </div>
          </div>

          {/* Telegram Notification */}
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-white flex items-center gap-2">
                  <span>✈️</span> 텔레그램 알림
                </p>
                <p className="text-xs text-zinc-500 mt-1">텔레그램 봇으로 학습 알림을 받습니다</p>
                {settings.telegram_chat_id ? (
                  <p className="text-xs text-emerald-400 mt-1">→ 연결됨 (ID: {settings.telegram_chat_id})</p>
                ) : (
                  <p className="text-xs text-amber-400 mt-1">→ 텔레그램 봇을 연결해주세요</p>
                )}
              </div>
              <button
                onClick={() => handleToggleChange('telegram_enabled', !settings.telegram_enabled)}
                disabled={!settings.telegram_chat_id}
                className={`relative w-14 h-8 rounded-full transition-all ${
                  !settings.telegram_chat_id ? 'bg-zinc-700 cursor-not-allowed opacity-50' :
                  settings.telegram_enabled ? 'bg-[#0088cc]' : 'bg-zinc-700'
                }`}
              >
                <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${settings.telegram_enabled && settings.telegram_chat_id ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>
            <div className="pt-3 border-t border-white/5">
              {!settings.telegram_chat_id ? (
                <div className="space-y-3">
                  <p className="text-xs text-zinc-400">텔레그램 봇을 연결하려면:</p>
                  <ol className="text-xs text-zinc-500 space-y-1 list-decimal list-inside">
                    <li>아래 버튼을 눌러 텔레그램 봇으로 이동</li>
                    <li>봇에서 /start 명령어 입력</li>
                    <li>이메일 주소 입력하여 연결 완료</li>
                    <li>연결 후 아래 새로고침 버튼 클릭</li>
                  </ol>
                  <div className="flex gap-2">
                    <a
                      href="https://t.me/yessirpanda_bot"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0088cc] text-white text-sm font-medium rounded-lg hover:bg-[#0077b5] transition-colors"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                      </svg>
                      텔레그램 봇 연결하기
                    </a>
                    <button
                      onClick={handleRefreshSettings}
                      disabled={refreshingSettings}
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-zinc-700 text-white text-sm font-medium rounded-lg hover:bg-zinc-600 transition-colors disabled:opacity-50"
                    >
                      {refreshingSettings ? '새로고침 중...' : '연결 확인'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-emerald-400">텔레그램 봇이 연결되어 있습니다</p>
                  <button
                    onClick={async () => {
                      const newSettings = { ...settings, telegram_chat_id: '', telegram_enabled: false }
                      setSettings(newSettings)
                      await saveSettings(newSettings, true)
                      showToast('텔레그램 연결이 해제되었습니다')
                    }}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    연결 해제
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Google Chat Notification */}
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-white flex items-center gap-2">
                  <span>💬</span> 구글 챗 알림
                  <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">Workspace</span>
                </p>
                <p className="text-xs text-zinc-500 mt-1">구글 워크스페이스 채팅방으로 알림을 받습니다</p>
                {settings.google_chat_webhook && settings.google_chat_webhook.startsWith('https://chat.googleapis.com/') ? (
                  <p className="text-xs text-emerald-400 mt-1">→ 웹훅 연결됨</p>
                ) : (
                  <p className="text-xs text-amber-400 mt-1">→ 구글 챗 웹훅을 등록해주세요</p>
                )}
              </div>
              <button
                onClick={() => handleToggleChange('google_chat_enabled', !settings.google_chat_enabled)}
                disabled={!settings.google_chat_webhook || !settings.google_chat_webhook.startsWith('https://chat.googleapis.com/')}
                className={`relative w-14 h-8 rounded-full transition-all ${
                  !settings.google_chat_webhook || !settings.google_chat_webhook.startsWith('https://chat.googleapis.com/') ? 'bg-zinc-700 cursor-not-allowed opacity-50' :
                  settings.google_chat_enabled ? 'bg-[#1a73e8]' : 'bg-zinc-700'
                }`}
              >
                <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${settings.google_chat_enabled && settings.google_chat_webhook && settings.google_chat_webhook.startsWith('https://chat.googleapis.com/') ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>
            <div className="pt-3 border-t border-white/5">
              {!settings.google_chat_webhook || !settings.google_chat_webhook.startsWith('https://chat.googleapis.com/') ? (
                <div className="space-y-3">
                  <p className="text-xs text-zinc-400">구글 챗 웹훅을 설정하려면:</p>
                  <ol className="text-xs text-zinc-500 space-y-1 list-decimal list-inside">
                    <li>구글 챗에서 스페이스(채팅방) 생성</li>
                    <li>스페이스 설정 → 앱 및 통합 → 웹훅 추가</li>
                    <li>웹훅 URL을 아래에 붙여넣기 후 저장 클릭</li>
                  </ol>
                  <input
                    type="url"
                    placeholder="https://chat.googleapis.com/v1/spaces/..."
                    value={settings.google_chat_webhook}
                    onChange={e => setSettings(s => ({ ...s, google_chat_webhook: e.target.value }))}
                    className="w-full bg-[#121214] border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                  {settings.google_chat_webhook && !settings.google_chat_webhook.startsWith('https://chat.googleapis.com/') && (
                    <p className="text-xs text-red-400">올바른 구글 챗 웹훅 URL을 입력해주세요</p>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-emerald-400">구글 챗 웹훅이 연결되어 있습니다</p>
                  <button
                    onClick={async () => {
                      const newSettings = { ...settings, google_chat_webhook: '', google_chat_enabled: false }
                      setSettings(newSettings)
                      await saveSettings(newSettings, true)
                      showToast('구글 챗 연결이 해제되었습니다')
                    }}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    연결 해제
                  </button>
                </div>
              )}
            </div>
          </div>
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
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="text-violet-400">🔗</span> SNS 계정 연동
        </h2>
        <div className="space-y-3">
          {linkedProviders.map((provider) => (
            <div key={provider.id} className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                  provider.id === 'kakao' ? 'bg-[#FEE500]' : provider.id === 'google' ? 'bg-white' : 'bg-[#03C75A]'
                }`}>
                  {provider.id === 'kakao' && <svg width="20" height="20" viewBox="0 0 24 24" fill="#191919"><path d="M12 3C6.477 3 2 6.477 2 10.5c0 2.47 1.607 4.647 4.041 5.902-.127.47-.82 3.03-.853 3.227 0 0-.017.134.07.186.087.052.19.012.19.012.25-.035 2.9-1.9 3.36-2.22.39.054.79.082 1.192.082 5.523 0 10-3.477 10-7.5S17.523 3 12 3"/></svg>}
                  {provider.id === 'google' && <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>}
                  {provider.id === 'naver' && <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727v12.845z"/></svg>}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{provider.name}</p>
                  <p className="text-xs text-zinc-500">{provider.linked ? '연동됨' : '연동 안됨'}</p>
                </div>
              </div>
              <button
                onClick={() => provider.linked ? handleUnlinkProvider(provider.id) : handleLinkProvider(provider.id)}
                disabled={linkingProvider === provider.id}
                className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${
                  provider.linked ? 'text-red-400 bg-red-400/10 hover:bg-red-400/20' : 'text-violet-400 bg-violet-400/10 hover:bg-violet-400/20'
                }`}
              >
                {linkingProvider === provider.id ? '처리 중...' : provider.linked ? '연동 해제' : '연동하기'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Invite Link */}
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="text-violet-400">🎁</span> 친구 초대
        </h2>
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-xs text-zinc-500 mb-1">나의 초대 링크</p>
              <p className="text-sm text-white font-mono break-all">
                {typeof window !== 'undefined' ? `${window.location.origin}/invite/${inviteCode}` : '...'}
              </p>
            </div>
            <button
              onClick={handleCopyInviteLink}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                copySuccess ? 'bg-emerald-500 text-white' : 'bg-violet-500/20 text-violet-400 hover:bg-violet-500/30'
              }`}
            >
              {copySuccess ? '복사됨!' : '복사'}
            </button>
          </div>
        </div>
      </div>

      {/* Admin Tools (Collapsible) */}
      <div className="card p-6 space-y-4">
        <button
          onClick={() => setShowAdminTools(!showAdminTools)}
          className="w-full flex items-center justify-between"
        >
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-violet-400">🛠️</span> 관리자 도구
          </h2>
          <span className="text-zinc-500">{showAdminTools ? '▲' : '▼'}</span>
        </button>

        {showAdminTools && (
          <div className="space-y-4 pt-4 border-t border-white/5">
            <p className="text-xs text-zinc-500">수동으로 이메일 워크플로우를 실행합니다</p>
            <div className="grid grid-cols-3 gap-3">
              {workflows.map((wf) => (
                <button
                  key={wf.id}
                  onClick={() => handleTriggerWorkflow(wf.id)}
                  disabled={triggeringWorkflow === wf.id}
                  className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] transition-all text-center disabled:opacity-50"
                >
                  <div className="text-2xl mb-2">{wf.emoji}</div>
                  <p className="text-sm font-medium text-white">{wf.name}</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    {triggeringWorkflow === wf.id ? '실행 중...' : wf.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
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

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-white/5 rounded w-40" />
        <div className="h-40 bg-white/5 rounded-2xl" />
        <div className="h-60 bg-white/5 rounded-2xl" />
      </div>
    }>
      <SettingsPageContent />
    </Suspense>
  )
}
