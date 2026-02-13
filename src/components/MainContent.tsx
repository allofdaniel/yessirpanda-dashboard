'use client'

import { useState, useEffect, ReactNode } from 'react'

interface MainContentProps {
  children: ReactNode
  hasUser: boolean
}

export default function MainContent({ children, hasUser }: MainContentProps) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    // Load initial state from localStorage
    const saved = localStorage.getItem('sidebarCollapsed')
    if (saved === 'true') setCollapsed(true)

    // Listen for sidebar toggle events
    const handleToggle = (e: CustomEvent<{ collapsed: boolean }>) => {
      setCollapsed(e.detail.collapsed)
    }

    window.addEventListener('sidebarToggle', handleToggle as EventListener)
    return () => window.removeEventListener('sidebarToggle', handleToggle as EventListener)
  }, [])

  return (
    <main
      className={`transition-all duration-300 ${
        hasUser ? `pb-20 md:pb-0 ${collapsed ? 'md:pl-[72px]' : 'md:pl-64'}` : ''
      }`}
    >
      <div className={hasUser ? 'mx-auto max-w-6xl px-5 py-6 md:py-8' : ''}>
        {children}
      </div>
    </main>
  )
}
