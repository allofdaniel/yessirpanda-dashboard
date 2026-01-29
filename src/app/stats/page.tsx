'use client';

import { useEffect, useState } from 'react';

interface Attendance {
  Email: string;
  Date: string;
  Type: 'morning' | 'lunch' | 'evening';
  Completed: boolean;
}

interface Result {
  Email: string;
  Day: number;
  QuizType: 'morning' | 'lunch';
  Word: string;
  CorrectAnswer: string;
  UserAnswer: string;
  IsCorrect: boolean;
  Timestamp: string;
}

interface Config {
  CurrentDay: string;
  TotalDays: string;
  SpreadsheetId?: string;
}

export default function StatsPage() {
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userEmail = 'allofdaniel1@gmail.com';

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const [attendanceRes, resultsRes, configRes] = await Promise.all([
          fetch(`/api/attendance?email=${userEmail}`),
          fetch(`/api/results?email=${userEmail}`),
          fetch('/api/config'),
        ]);

        if (!attendanceRes.ok || !resultsRes.ok || !configRes.ok) {
          throw new Error('Failed to fetch data');
        }

        const [attendanceData, resultsData, configData] = await Promise.all([
          attendanceRes.json(),
          resultsRes.json(),
          configRes.json(),
        ]);

        setAttendance(attendanceData);
        setResults(resultsData);
        setConfig(configData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Calculate streak (consecutive days from today backward)
  const calculateStreak = () => {
    if (attendance.length === 0) return 0;

    // Get unique dates with attendance
    const uniqueDates = Array.from(
      new Set(attendance.map((a) => a.Date))
    ).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let streak = 0;
    let checkDate = new Date(today);

    for (const dateStr of uniqueDates) {
      const date = new Date(dateStr);
      date.setHours(0, 0, 0, 0);

      // Check if this date matches our expected date
      if (date.getTime() === checkDate.getTime()) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (date.getTime() < checkDate.getTime()) {
        // Gap found, stop counting
        break;
      }
    }

    return streak;
  };

  // Calculate quiz accuracy
  const calculateAccuracy = () => {
    if (results.length === 0) return { accuracy: 0, correct: 0, total: 0 };

    const correct = results.filter((r) => r.IsCorrect).length;
    const total = results.length;
    const accuracy = (correct / total) * 100;

    return { accuracy: Math.round(accuracy), correct, total };
  };

  // Get calendar data for current month
  const getCalendarData = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay(); // 0 = Sunday

    // Count attendance types per date
    const attendanceByDate = new Map<string, Set<string>>();
    attendance.forEach((a) => {
      const date = a.Date;
      if (!attendanceByDate.has(date)) {
        attendanceByDate.set(date, new Set());
      }
      attendanceByDate.get(date)!.add(a.Type);
    });

    return { year, month, daysInMonth, startDayOfWeek, attendanceByDate };
  };

  // Get last 7 days performance
  const getLast7DaysPerformance = () => {
    const days = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayName = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];

      // Calculate accuracy for this day
      const dayResults = results.filter((r) => r.Timestamp.startsWith(dateStr));
      const correct = dayResults.filter((r) => r.IsCorrect).length;
      const total = dayResults.length;
      const accuracy = total > 0 ? (correct / total) * 100 : 0;

      days.push({ date: dateStr, dayName, accuracy: Math.round(accuracy), total });
    }

    return days;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center pb-24">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center pb-24">
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  const streak = calculateStreak();
  const { accuracy, correct, total } = calculateAccuracy();
  const calendarData = getCalendarData();
  const last7Days = getLast7DaysPerformance();
  const monthNames = [
    '1월', '2월', '3월', '4월', '5월', '6월',
    '7월', '8월', '9월', '10월', '11월', '12월',
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white pb-24 px-4 py-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <h1 className="text-3xl font-bold mb-6">📊 학습 통계</h1>

        {/* Streak Card */}
        <div className="bg-gradient-to-br from-green-900/40 to-green-800/40 rounded-lg p-6 border border-green-700/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-300 text-sm mb-1">연속 출석일</p>
              <p className="text-5xl font-bold text-white">{streak}</p>
              <p className="text-green-300 text-sm mt-1">일 연속</p>
            </div>
            <div className="text-6xl">🔥</div>
          </div>
        </div>

        {/* Calendar Heatmap */}
        <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
          <h2 className="text-xl font-semibold mb-4">
            {calendarData.year}년 {monthNames[calendarData.month]}
          </h2>
          <div className="grid grid-cols-7 gap-2">
            {/* Day headers */}
            {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
              <div key={day} className="text-center text-xs text-gray-400 mb-1">
                {day}
              </div>
            ))}

            {/* Empty cells for offset */}
            {Array.from({ length: calendarData.startDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}

            {/* Calendar days */}
            {Array.from({ length: calendarData.daysInMonth }).map((_, i) => {
              const day = i + 1;
              const date = new Date(calendarData.year, calendarData.month, day);
              const dateStr = date.toISOString().split('T')[0];
              const attendanceTypes = calendarData.attendanceByDate.get(dateStr);
              const attendanceCount = attendanceTypes ? attendanceTypes.size : 0;

              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const isToday = date.getTime() === today.getTime();

              let bgColor = 'bg-gray-700/50';
              if (attendanceCount === 1 || attendanceCount === 2) {
                bgColor = 'bg-yellow-500/60';
              } else if (attendanceCount >= 3) {
                bgColor = 'bg-green-500/60';
              }

              return (
                <div
                  key={day}
                  className={`aspect-square rounded-md ${bgColor} flex items-center justify-center text-sm ${
                    isToday ? 'ring-2 ring-purple-500' : ''
                  }`}
                >
                  {day}
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 mt-4 text-xs text-gray-400">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-gray-700/50"></div>
              <span>없음</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-yellow-500/60"></div>
              <span>일부</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-500/60"></div>
              <span>완료</span>
            </div>
          </div>
        </div>

        {/* Quiz Performance Card */}
        <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
          <h2 className="text-xl font-semibold mb-4">퀴즈 성적</h2>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div
                className="w-32 h-32 rounded-full mx-auto relative"
                style={{
                  background: `conic-gradient(#10b981 ${accuracy * 3.6}deg, #374151 0deg)`,
                }}
              >
                <div className="absolute inset-2 bg-gray-800 rounded-full flex items-center justify-center">
                  <span className="text-3xl font-bold">{accuracy}%</span>
                </div>
              </div>
            </div>
            <div className="flex-1 text-right">
              <p className="text-gray-400 text-sm mb-2">총 {total}문제 중</p>
              <p className="text-4xl font-bold text-green-400">{correct}</p>
              <p className="text-gray-400 text-sm mt-2">개 정답</p>
            </div>
          </div>
        </div>

        {/* Daily Breakdown */}
        <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
          <h2 className="text-xl font-semibold mb-4">최근 7일 성적</h2>
          <div className="flex items-end justify-between gap-2 h-48">
            {last7Days.map((day) => (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-2">
                <div className="flex-1 w-full flex items-end">
                  <div
                    className="w-full bg-gradient-to-t from-purple-500 to-purple-400 rounded-t-md transition-all"
                    style={{ height: `${day.accuracy}%` }}
                  />
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400">{day.dayName}</p>
                  {day.total > 0 && (
                    <p className="text-xs text-purple-400 mt-1">{day.accuracy}%</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
