"use client";

import { useEffect, useState, useCallback } from "react";
import { createAuthBrowserClient } from "@/lib/supabase-auth";

interface Attendance {
  Email: string;
  Date: string;
  Type: string;
  Completed: boolean;
}

interface Result {
  Email: string;
  Day: number;
  QuizType: string;
  Word: string;
  CorrectAnswer: string;
  UserAnswer: string;
  IsCorrect: boolean;
  Timestamp: string;
}

interface Config {
  CurrentDay: number;
  TotalDays: number;
}

export default function StatsPage() {
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [, setConfig] = useState<Config | null>(null); // Config loaded but not currently displayed
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const supabase = createAuthBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      const email = user?.email || '';
      const [attendanceRes, resultsRes, configRes] = await Promise.all([
        fetch(`/api/attendance?email=${encodeURIComponent(email)}`),
        fetch(`/api/results?email=${encodeURIComponent(email)}`),
        fetch("/api/config"),
      ]);

      if (!attendanceRes.ok || !resultsRes.ok || !configRes.ok) {
        throw new Error("Failed to fetch data");
      }

      const attendanceData = await attendanceRes.json();
      const resultsData = await resultsRes.json();
      const configData = await configRes.json();

      setAttendance(attendanceData);
      setResults(resultsData);
      setConfig(configData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Calculate streak (allows starting from yesterday if today has no attendance)
  const calculateStreak = () => {
    const sortedDates = [...new Set(attendance.map((a) => a.Date))].sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime()
    );
    if (sortedDates.length === 0) return 0;

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if most recent attendance is today or yesterday
    const latestDate = new Date(sortedDates[0]);
    latestDate.setHours(0, 0, 0, 0);
    const initialDiff = Math.floor(
      (today.getTime() - latestDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Only count streak if latest attendance is within 1 day (today or yesterday)
    if (initialDiff > 1) return 0;

    for (let i = 0; i < sortedDates.length; i++) {
      const date = new Date(sortedDates[i]);
      date.setHours(0, 0, 0, 0);
      const daysDiff = Math.floor(
        (today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Allow starting from yesterday (initialDiff) and count consecutive days
      if (daysDiff === i + initialDiff) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  };

  // Calculate accuracy
  const accuracy =
    results.length > 0
      ? Math.round(
          (results.filter((r) => r.IsCorrect).length / results.length) * 100
        )
      : 0;

  // Generate calendar heatmap
  const generateCalendar = () => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const calendar = [];
    let week = [];

    // Add empty cells for days before the first day
    for (let i = 0; i < startDayOfWeek; i++) {
      week.push(null);
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(
        2,
        "0"
      )}-${String(day).padStart(2, "0")}`;
      const dayAttendance = attendance.filter((a) => a.Date === dateStr);
      const completed = dayAttendance.filter((a) => a.Completed);

      week.push({
        day,
        dateStr,
        level:
          completed.length === 0
            ? "none"
            : completed.length === dayAttendance.length
            ? "full"
            : "partial",
        isToday:
          day === today.getDate() &&
          currentMonth === today.getMonth() &&
          currentYear === today.getFullYear(),
      });

      if (week.length === 7) {
        calendar.push(week);
        week = [];
      }
    }

    // Add remaining week if not empty
    if (week.length > 0) {
      while (week.length < 7) {
        week.push(null);
      }
      calendar.push(week);
    }

    return calendar;
  };

  // Last 7 days performance
  const getLast7Days = () => {
    const last7 = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      const dayResults = results.filter((r) => r.Timestamp.startsWith(dateStr));
      const dayAccuracy =
        dayResults.length > 0
          ? Math.round(
              (dayResults.filter((r) => r.IsCorrect).length /
                dayResults.length) *
                100
            )
          : 0;

      last7.push({
        date: dateStr,
        label: date.toLocaleDateString("ko-KR", { weekday: "short" }),
        accuracy: dayAccuracy,
        count: dayResults.length,
      });
    }

    return last7;
  };

  const streak = calculateStreak();
  const calendar = generateCalendar();
  const last7Days = getLast7Days();
  const correctCount = results.filter((r) => r.IsCorrect).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-zinc-600">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  const monthNames = [
    "1월",
    "2월",
    "3월",
    "4월",
    "5월",
    "6월",
    "7월",
    "8월",
    "9월",
    "10월",
    "11월",
    "12월",
  ];
  const today = new Date();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-3xl font-bold text-zinc-100 mb-2">
          📊 학습 통계
        </h1>
        <p className="text-zinc-400">당신의 학습 여정을 확인하세요</p>
      </div>

      {/* Streak Card */}
      <div className="card p-6 bg-gradient-to-br from-emerald-900/30 to-emerald-800/20 border-emerald-500/20 animate-fade-in stagger-1">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-zinc-100 mb-1">
              연속 학습
            </h3>
            <p className="text-sm text-zinc-400">계속 이어가세요!</p>
          </div>
          <div className="text-5xl font-bold text-emerald-400">
            {streak} 🔥
          </div>
        </div>
      </div>

      {/* Calendar Heatmap */}
      <div className="card p-6 animate-fade-in stagger-2">
        <h3 className="text-lg font-semibold text-zinc-100 mb-4">
          {monthNames[today.getMonth()]} {today.getFullYear()}
        </h3>
        <div className="space-y-2">
          <div className="grid grid-cols-7 gap-2 text-xs text-zinc-600 mb-2">
            {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
              <div key={day} className="text-center">
                {day}
              </div>
            ))}
          </div>
          {calendar.map((week, weekIdx) => (
            <div key={weekIdx} className="grid grid-cols-7 gap-2">
              {week.map((day, dayIdx) => (
                <div
                  key={dayIdx}
                  className={`h-10 rounded flex items-center justify-center text-sm ${
                    !day
                      ? ""
                      : day.isToday
                      ? "ring-2 ring-violet-500"
                      : ""
                  } ${
                    !day
                      ? "bg-transparent"
                      : day.level === "none"
                      ? "bg-zinc-800/50 text-zinc-600"
                      : day.level === "partial"
                      ? "bg-amber-500/50 text-amber-100"
                      : "bg-emerald-500/50 text-emerald-100"
                  }`}
                >
                  {day?.day}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Quiz Performance */}
      <div className="card p-6 animate-fade-in stagger-3">
        <h3 className="text-lg font-semibold text-zinc-100 mb-4">
          퀴즈 성과
        </h3>
        <div className="flex items-center justify-center gap-8">
          <div className="relative w-32 h-32">
            <div
              className="w-full h-full rounded-full"
              style={{
                background: `conic-gradient(from 0deg, #a855f7 0%, #ec4899 ${accuracy}%, #27272a ${accuracy}%)`,
              }}
            ></div>
            <div className="absolute inset-2 bg-black rounded-full flex items-center justify-center">
              <div className="text-center">
                <div className="text-2xl font-bold text-zinc-100">
                  {accuracy}%
                </div>
                <div className="text-xs text-zinc-600">정확도</div>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-sm text-zinc-400">
              정답: <span className="text-emerald-400 font-semibold">{correctCount}</span>
            </div>
            <div className="text-sm text-zinc-400">
              전체: <span className="text-zinc-100 font-semibold">{results.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Last 7 Days Bar Chart */}
      <div className="card p-6 animate-fade-in stagger-4">
        <h3 className="text-lg font-semibold text-zinc-100 mb-4">
          최근 7일 성과
        </h3>
        <div className="flex items-end justify-between gap-2 h-48">
          {last7Days.map((day, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center gap-2">
              <div className="flex-1 w-full flex items-end">
                <div
                  className="w-full bg-gradient-to-t from-violet-500 to-pink-500 rounded-t transition-all"
                  style={{ height: `${day.accuracy}%` }}
                  title={`${day.accuracy}% (${day.count}문제)`}
                ></div>
              </div>
              <div className="text-xs text-zinc-600">{day.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
