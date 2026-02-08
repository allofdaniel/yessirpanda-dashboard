'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { createAuthBrowserClient } from '@/lib/supabase-auth';

interface Config {
  CurrentDay: string;
  TotalDays: string;
}

interface Word {
  Day: number;
  Word: string;
  Meaning: string;
}

interface WrongWord {
  Word: string;
  Meaning: string;
  WrongCount: number;
}

interface Attendance {
  Date: string;
  Type: string;
  Completed: boolean;
}

interface PostponedData {
  postponedDays: number[];
}

export default function HomePage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [words, setWords] = useState<Word[]>([]);
  const [wrongWords, setWrongWords] = useState<WrongWord[]>([]);
  const [attendanceList, setAttendanceList] = useState<Attendance[]>([]);
  const [postponedDays, setPostponedDays] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState('학습자');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createAuthBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      const email = user?.email || '';
      setUserName(user?.user_metadata?.name || '학습자');

      const [configRes, wordsRes, wrongRes, attendanceRes, postponeRes] = await Promise.all([
        fetch('/api/config'),
        fetch('/api/words'),
        fetch(`/api/wrong?email=${encodeURIComponent(email)}`),
        fetch(`/api/attendance?email=${encodeURIComponent(email)}`),
        fetch(`/api/postpone?email=${encodeURIComponent(email)}`),
      ]);

      if (!configRes.ok || !wordsRes.ok || !wrongRes.ok || !attendanceRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const [configData, wordsData, wrongData, attendanceData, postponeData] = await Promise.all([
        configRes.json(),
        wordsRes.json(),
        wrongRes.json(),
        attendanceRes.json(),
        postponeRes.ok ? postponeRes.json() : { postponedDays: [] },
      ]);

      setConfig(configData);
      setWords(wordsData);
      setWrongWords(wrongData);
      setAttendanceList(attendanceData);
      setPostponedDays(postponeData.postponedDays || []);
    } catch (err) {
      setError('데이터를 불러오는데 실패했습니다.');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-8">
        {/* Hero Skeleton */}
        <div className="bg-zinc-900 animate-pulse rounded-xl h-32" />

        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-zinc-900 animate-pulse rounded-xl h-24" />
          ))}
        </div>

        {/* Two Column Skeleton */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-zinc-900 animate-pulse rounded-xl h-48" />
          <div className="bg-zinc-900 animate-pulse rounded-xl h-48" />
        </div>

        {/* Recent Wrong Words Skeleton */}
        <div className="bg-zinc-900 animate-pulse rounded-xl h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div className="card p-8 text-center">
          <p className="text-zinc-400 mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="btn-accent px-6 py-2"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  const currentDay = parseInt(config?.CurrentDay || '0');
  const totalDays = parseInt(config?.TotalDays || '0');
  const progressPercent = totalDays > 0 ? (currentDay / totalDays) * 100 : 0;

  const masteredWords = words.filter((w) => w.Day < currentDay).length;
  const reviewWords = wrongWords.length;
  const today = new Date().toISOString().split('T')[0];
  const todayAtt = attendanceList.filter((a) => a.Date === today);
  const todayAttendance = {
    morning: todayAtt.some((a) => a.Type === 'morning' && a.Completed),
    lunch: todayAtt.some((a) => a.Type === 'lunch' && a.Completed),
    evening: todayAtt.some((a) => a.Type === 'evening' && a.Completed),
  };

  // Calculate streak (consecutive days with at least one activity)
  const sortedDates = [...new Set(attendanceList.filter((a) => a.Completed).map((a) => a.Date))].sort().reverse();
  let currentStreak = 0;
  for (let i = 0; i < sortedDates.length; i++) {
    const dateObj = new Date(sortedDates[i]);
    const expectedDate = new Date(today);
    expectedDate.setDate(expectedDate.getDate() - i);
    const expectedDateStr = expectedDate.toISOString().split('T')[0];
    if (sortedDates[i] === expectedDateStr) {
      currentStreak++;
    } else {
      break;
    }
  }

  // Get last 7 days for mini calendar
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return date.toISOString().split('T')[0];
  });

  return (
    <div className="space-y-8">
      {/* Hero Card */}
      <div className="card card-glow p-6 relative overflow-hidden animate-fade-in stagger-1">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 to-pink-600/10 border border-violet-500/20 rounded-xl" />
        <div className="relative">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold gradient-text mb-2">
                옛설판다 👋
              </h1>
              <p className="text-xl text-zinc-400">{userName}님, 안녕하세요!</p>
            </div>
            <div className="inline-flex items-center gap-2 bg-black/30 backdrop-blur-sm px-5 py-2.5 rounded-full border border-violet-500/30">
              <span className="text-sm text-zinc-400">Day</span>
              <span className="text-2xl font-bold gradient-text">
                {currentDay}/{totalDays}
              </span>
            </div>
          </div>
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400">전체 진도율</span>
              <span className="text-violet-400 font-semibold">{progressPercent.toFixed(1)}%</span>
            </div>
            <div className="h-3 bg-zinc-900/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-600 to-pink-600 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 animate-fade-in stagger-2">
        <div className="card p-5">
          <p className="text-zinc-500 text-xs uppercase tracking-wider mb-2">현재 Day</p>
          <p className="text-3xl font-bold text-violet-400">{currentDay}</p>
        </div>
        <div className="card p-5">
          <p className="text-zinc-500 text-xs uppercase tracking-wider mb-2">총 단어</p>
          <p className="text-3xl font-bold text-blue-400">{words.length}</p>
        </div>
        <div className="card p-5">
          <p className="text-zinc-500 text-xs uppercase tracking-wider mb-2">마스터</p>
          <p className="text-3xl font-bold text-emerald-400">{masteredWords}</p>
        </div>
        <div className="card p-5">
          <p className="text-zinc-500 text-xs uppercase tracking-wider mb-2">복습 필요</p>
          <p className="text-3xl font-bold text-amber-400">{reviewWords}</p>
        </div>
        <div className="card p-5">
          <p className="text-zinc-500 text-xs uppercase tracking-wider mb-2">연속 출석</p>
          <p className="text-3xl font-bold text-orange-400">{currentStreak}일</p>
        </div>
      </div>

      {/* Two-column grid */}
      <div className="grid md:grid-cols-2 gap-6 animate-fade-in stagger-3">
        {/* Left: 오늘의 학습 현황 */}
        <div className="card card-glow p-6">
          <h2 className="text-xl font-bold text-zinc-100 mb-6">오늘의 학습 현황</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/50">
              <span className="text-zinc-300">아침 단어</span>
              {todayAttendance.morning ? (
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center">
                  <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full bg-zinc-700" />
              )}
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/50">
              <span className="text-zinc-300">점심 테스트</span>
              {todayAttendance.lunch ? (
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center">
                  <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full bg-zinc-700" />
              )}
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/50">
              <span className="text-zinc-300">저녁 복습</span>
              {todayAttendance.evening ? (
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center">
                  <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full bg-zinc-700" />
              )}
            </div>
          </div>
        </div>

        {/* Right: 출석 현황 (7일 미니 캘린더) */}
        <div className="card card-glow p-6">
          <h2 className="text-xl font-bold text-zinc-100 mb-6">출석 현황</h2>
          <div className="space-y-4">
            {/* 7-day mini calendar */}
            <div className="grid grid-cols-7 gap-2">
              {last7Days.map((date, index) => {
                const dayAttendance = attendanceList.filter(
                  (a) => a.Date === date && a.Completed
                );
                const hasActivity = dayAttendance.length > 0;
                const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][new Date(date).getDay()];
                const dayOfMonth = new Date(date).getDate();
                const isToday = date === today;

                return (
                  <div
                    key={index}
                    className={`aspect-square flex flex-col items-center justify-center rounded-lg transition-all ${
                      isToday
                        ? 'bg-violet-600/20 border-2 border-violet-500'
                        : hasActivity
                        ? 'bg-emerald-500/10 border border-emerald-500/30'
                        : 'bg-zinc-900/50 border border-zinc-800'
                    }`}
                  >
                    <div className={`text-xs ${isToday ? 'text-violet-400' : 'text-zinc-500'}`}>
                      {dayOfWeek}
                    </div>
                    <div
                      className={`text-sm font-semibold ${
                        isToday
                          ? 'text-violet-300'
                          : hasActivity
                          ? 'text-emerald-400'
                          : 'text-zinc-600'
                      }`}
                    >
                      {dayOfMonth}
                    </div>
                    {hasActivity && !isToday && (
                      <div className="w-1 h-1 mt-1 rounded-full bg-emerald-500" />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-sm text-zinc-400">학습 완료</span>
              </div>
              <Link
                href="/stats"
                className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
              >
                전체 보기 →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Review Section: Two columns */}
      <div className="grid md:grid-cols-2 gap-6 animate-fade-in stagger-4">
        {/* Left: 미룬 단어 복습 */}
        {postponedDays.length > 0 && (
          <div className="card card-glow p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-zinc-100">미룬 단어 복습</h2>
              <Link
                href="/postpone"
                className="text-violet-400 hover:text-violet-300 transition-colors duration-200 text-sm font-medium"
              >
                학습 시작 →
              </Link>
            </div>
            <div className="space-y-3">
              {postponedDays.slice(0, 3).map((day, index) => {
                const dayWords = words.filter((w) => w.Day === day);
                return (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 rounded-lg bg-zinc-900/50 hover:bg-zinc-900 transition-colors duration-200"
                  >
                    <div className="flex-1">
                      <p className="text-lg font-semibold text-zinc-100 mb-1">Day {day}</p>
                      <p className="text-sm text-zinc-500">{dayWords.length}개 단어</p>
                    </div>
                    <div className="ml-4 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30">
                      <span className="text-amber-400 text-sm font-semibold">복습 대기</span>
                    </div>
                  </div>
                );
              })}
              {postponedDays.length > 3 && (
                <p className="text-center text-sm text-zinc-500 pt-2">
                  외 {postponedDays.length - 3}개 더
                </p>
              )}
            </div>
          </div>
        )}

        {/* Right: 최근 오답 단어 */}
        <div className={`card card-glow p-6 ${postponedDays.length === 0 ? 'md:col-span-2' : ''}`}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-zinc-100">최근 오답 단어</h2>
            <Link
              href="/wrong"
              className="text-violet-400 hover:text-violet-300 transition-colors duration-200 text-sm font-medium"
            >
              더 보기 →
            </Link>
          </div>

          {wrongWords.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">🎉</div>
              <p className="text-zinc-400">아직 틀린 단어가 없습니다!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {wrongWords.slice(0, postponedDays.length > 0 ? 3 : 5).map((word, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 rounded-lg bg-zinc-900/50 hover:bg-zinc-900 transition-colors duration-200"
                >
                  <div className="flex-1">
                    <p className="text-lg font-semibold text-zinc-100 mb-1">{word.Word}</p>
                    <p className="text-sm text-zinc-500">{word.Meaning}</p>
                  </div>
                  <div className="ml-4 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30">
                    <span className="text-red-400 text-sm font-semibold">{word.WrongCount}회</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
