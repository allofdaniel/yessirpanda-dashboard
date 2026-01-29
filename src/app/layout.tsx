import type { Metadata } from 'next'
import { Space_Grotesk } from 'next/font/google'
import './globals.css'
import Navigation from '@/components/Navigation'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
})

export const metadata: Metadata = {
  title: '옛설판다 대시보드',
  description: '옛설판다 - 한국어 영어 학습을 위한 스마트 대시보드. 단어장, 오답 노트, 학습 통계를 한눈에 관리하세요.',
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
      </body>
    </html>
  )
}
