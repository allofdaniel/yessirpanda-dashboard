import type { Metadata, Viewport } from 'next'
import { Space_Grotesk } from 'next/font/google'
import './globals.css'
import Navigation from '@/components/Navigation'
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
})

export const metadata: Metadata = {
  title: '옛설판다',
  description: '비즈니스 영어 학습 대시보드 - 단어장, 오답 노트, 학습 통계',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '옛설판다',
  },
  icons: {
    icon: '/favicon.png',
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <body className={`${spaceGrotesk.variable} bg-black text-zinc-100 grain`}>
        <Navigation />
        <main className="pb-20 md:pb-0 md:pl-60">
          <div className="mx-auto max-w-6xl px-5 py-6 md:py-8">
            {children}
          </div>
        </main>
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
