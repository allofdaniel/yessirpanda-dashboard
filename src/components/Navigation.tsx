'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createAuthBrowserClient } from '@/lib/supabase-auth'
import { useState, useEffect } from 'react'
import PandaLogo from '@/components/PandaLogo'

interface NavProps {
  userEmail: string
  userName: string
}

const navItems = [
  { name: '홈', href: '/', icon: 'home' },
  { name: '단어장', href: '/words', icon: 'book' },
  { name: '복습', href: '/review', icon: 'review' },
  { name: '오답노트', href: '/wrong', icon: 'alert' },
  { name: '통계', href: '/stats', icon: 'chart' },
  { name: '설정', href: '/settings', icon: 'settings' },
]

function NavIcon({ icon, className }: { icon: string; className?: string }) {
  const cls = className || 'w-5 h-5'
  switch (icon) {
    case 'home':
      return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
    case 'book':
      return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
    case 'review':
      return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
    case 'alert':
      return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
    case 'chart':
      return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
    case 'settings':
      return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
    default:
      return null
  }
}

export default function Navigation({ userEmail, userName }: NavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)

  // Load collapsed state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('sidebarCollapsed')
    if (saved === 'true') setCollapsed(true)
  }, [])

  // Save collapsed state to localStorage
  const toggleCollapse = () => {
    const newState = !collapsed
    setCollapsed(newState)
    localStorage.setItem('sidebarCollapsed', String(newState))
    // Dispatch event for layout adjustment
    window.dispatchEvent(new CustomEvent('sidebarToggle', { detail: { collapsed: newState } }))
  }

  const handleLogout = async () => {
    const supabase = createAuthBrowserClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <nav
        className={`hidden md:flex fixed left-0 top-0 bottom-0 flex-col bg-[#09090b] border-r border-white/[0.06] z-40 transition-all duration-300 ${
          collapsed ? 'w-[72px]' : 'w-64'
        }`}
        aria-label="Main navigation"
      >
        {/* Header */}
        <div className={`p-4 flex items-center ${collapsed ? 'justify-center' : 'gap-3 px-6'}`}>
          <div className="w-10 h-10 bg-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-600/20 flex-shrink-0">
            <PandaLogo size="lg" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight leading-tight">옛설판다</h1>
              <p className="text-[11px] text-violet-400/70 font-medium">Premium Learning</p>
            </div>
          )}
        </div>

        {/* Toggle Button */}
        <button
          onClick={toggleCollapse}
          className="absolute -right-3 top-20 w-6 h-6 bg-zinc-800 border border-white/10 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors z-50"
          title={collapsed ? '메뉴 펼치기' : '메뉴 접기'}
        >
          <svg
            className={`w-3 h-3 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Navigation Links */}
        <div className="flex-1 px-3 py-2">
          <div className="flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.name : undefined}
                  className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                    collapsed ? 'justify-center' : ''
                  } ${
                    isActive
                      ? 'bg-violet-500/15 text-violet-400 border-l-[3px] border-violet-500'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03] border-l-[3px] border-transparent'
                  }`}
                >
                  <NavIcon icon={item.icon} />
                  {!collapsed && <span className="font-medium">{item.name}</span>}
                </Link>
              )
            })}
          </div>
        </div>

        {/* Footer - User Info */}
        <div className="p-4 border-t border-white/[0.06]">
          <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : 'px-2'} py-2`}>
            <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center text-sm flex-shrink-0">
              {userName.charAt(0)}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{userName}</p>
                <p className="text-[10px] text-zinc-500 truncate">{userEmail}</p>
              </div>
            )}
            <button
              onClick={handleLogout}
              className={`text-zinc-500 hover:text-red-400 transition-colors ${collapsed ? 'hidden' : ''}`}
              title="로그아웃"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#09090b] border-t border-white/[0.06] pb-[env(safe-area-inset-bottom)]" aria-label="Mobile navigation">
        <div className="flex justify-around h-16">
          {navItems.slice(0, 5).map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 transition-colors ${
                  isActive ? 'text-violet-400' : 'text-zinc-600'
                }`}
              >
                <NavIcon icon={item.icon} className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.name}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
