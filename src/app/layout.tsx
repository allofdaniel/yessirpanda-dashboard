import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/Navigation";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "옛설판다 대시보드",
  description: "옛설판다 한국어 학습 대시보드 - 단어장, 오답, 통계 관리",
  keywords: ["한국어", "학습", "대시보드", "단어장", "옛설판다"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 min-h-screen`}
      >
        <Navigation />
        <main className="pb-20 md:pb-0 md:pl-64">
          <div className="container mx-auto px-4 py-8 max-w-7xl">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
