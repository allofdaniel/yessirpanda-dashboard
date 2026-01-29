"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Config, Word, WrongWord, Attendance, Result } from "@/lib/types";

interface DashboardStats {
  currentDay: number;
  totalDays: number;
  totalWords: number;
  masteredWords: number;
  reviewNeeded: number;
}

interface TodayStatus {
  morning: boolean;
  lunch: boolean;
  evening: boolean;
}

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [todayStatus, setTodayStatus] = useState<TodayStatus | null>(null);
  const [recentWrongWords, setRecentWrongWords] = useState<WrongWord[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const userEmail = "allofdaniel1@gmail.com";

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all data in parallel
      const [configRes, wordsRes, wrongRes, attendanceRes] = await Promise.all([
        fetch("/api/config"),
        fetch("/api/words"),
        fetch(`/api/wrong?email=${userEmail}`),
        fetch(`/api/attendance?email=${userEmail}`),
      ]);

      if (!configRes.ok || !wordsRes.ok || !wrongRes.ok || !attendanceRes.ok) {
        throw new Error("Failed to fetch dashboard data");
      }

      const config: Config = await configRes.json();
      const words: Word[] = await wordsRes.json();
      const wrongWords: WrongWord[] = await wrongRes.json();
      const attendance: Attendance[] = await attendanceRes.json();

      // Calculate stats
      const currentDay = parseInt(config.CurrentDay);
      const totalDays = parseInt(config.TotalDays);
      const totalWords = words.length;
      const masteredWords = wrongWords.filter((w) => w.Mastered).length;
      const reviewNeeded = wrongWords.filter((w) => !w.Mastered).length;

      setStats({
        currentDay,
        totalDays,
        totalWords,
        masteredWords,
        reviewNeeded,
      });

      // Get today's date in YYYY-MM-DD format
      const today = new Date().toISOString().split("T")[0];
      const todayAttendance = attendance.filter((a) => a.Date === today);

      setTodayStatus({
        morning: todayAttendance.some(
          (a) => a.Type === "morning" && a.Completed
        ),
        lunch: todayAttendance.some((a) => a.Type === "lunch" && a.Completed),
        evening: todayAttendance.some(
          (a) => a.Type === "evening" && a.Completed
        ),
      });

      // Get top 5 wrong words sorted by wrong count
      const topWrongWords = wrongWords
        .filter((w) => !w.Mastered)
        .sort((a, b) => b.WrongCount - a.WrongCount)
        .slice(0, 5);

      setRecentWrongWords(topWrongWords);
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError("데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleMorningWords = async () => {
    try {
      setActionLoading("morning");
      const res = await fetch("/api/n8n/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflow: "morning-words" }),
      });

      if (!res.ok) throw new Error("Failed to trigger morning words");

      alert("아침 단어가 성공적으로 전송되었습니다! 📚");
    } catch (err) {
      console.error("Error triggering morning words:", err);
      alert("아침 단어 전송에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleAttendanceCheck = async () => {
    try {
      setActionLoading("attendance");
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userEmail,
          type: "morning",
          date: new Date().toISOString().split("T")[0],
        }),
      });

      if (!res.ok) throw new Error("Failed to check attendance");

      alert("출석 체크가 완료되었습니다! ✅");
      // Refresh data
      fetchDashboardData();
    } catch (err) {
      console.error("Error checking attendance:", err);
      alert("출석 체크에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setActionLoading(null);
    }
  };

  const getWrongCountBadgeColor = (count: number) => {
    if (count >= 5) return "bg-red-500/20 text-red-300 border-red-500/30";
    if (count >= 3) return "bg-orange-500/20 text-orange-300 border-orange-500/30";
    return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 max-w-md">
          <h2 className="text-red-400 text-xl font-semibold mb-2">오류 발생</h2>
          <p className="text-red-300">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-colors"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#667eea] to-[#764ba2] p-8 shadow-2xl">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-4xl">🦊</span>
            <h1 className="text-3xl font-bold text-white">옛설판다</h1>
          </div>
          <p className="text-xl text-white/90 mb-4">Daniel님, 안녕하세요!</p>
          {loading ? (
            <div className="inline-block h-8 w-32 bg-white/20 rounded-full animate-pulse"></div>
          ) : stats ? (
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full">
              <span className="text-white/80 text-sm font-medium">현재 진도</span>
              <span className="text-white text-lg font-bold">
                Day {stats.currentDay} / {stats.totalDays}
              </span>
            </div>
          ) : null}
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-24 -translate-x-24"></div>
      </div>

      {/* Progress Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          <>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-gray-800 rounded-xl p-6 shadow-lg animate-pulse">
                <div className="h-4 w-16 bg-gray-700 rounded mb-3"></div>
                <div className="h-8 w-24 bg-gray-700 rounded"></div>
              </div>
            ))}
          </>
        ) : stats ? (
          <>
            <div className="bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-700 hover:border-purple-500/50 transition-colors">
              <p className="text-gray-400 text-sm mb-2">현재 Day</p>
              <p className="text-3xl font-bold text-white">
                {stats.currentDay}
                <span className="text-lg text-gray-400 ml-1">/ {stats.totalDays}</span>
              </p>
            </div>
            <div className="bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-700 hover:border-blue-500/50 transition-colors">
              <p className="text-gray-400 text-sm mb-2">총 단어</p>
              <p className="text-3xl font-bold text-white">{stats.totalWords}</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-700 hover:border-green-500/50 transition-colors">
              <p className="text-gray-400 text-sm mb-2">마스터</p>
              <p className="text-3xl font-bold text-green-400">{stats.masteredWords}</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-700 hover:border-orange-500/50 transition-colors">
              <p className="text-gray-400 text-sm mb-2">복습 필요</p>
              <p className="text-3xl font-bold text-orange-400">{stats.reviewNeeded}</p>
            </div>
          </>
        ) : null}
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Today's Status Card */}
        <div className="bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-700">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span>📅</span>
            오늘의 학습 현황
          </h2>
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-700 rounded-lg animate-pulse"></div>
              ))}
            </div>
          ) : todayStatus ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                <span className="text-gray-300">아침 단어</span>
                <span className="text-2xl">{todayStatus.morning ? "✅" : "❌"}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                <span className="text-gray-300">점심 테스트</span>
                <span className="text-2xl">{todayStatus.lunch ? "✅" : "❌"}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                <span className="text-gray-300">저녁 복습</span>
                <span className="text-2xl">{todayStatus.evening ? "✅" : "❌"}</span>
              </div>
            </div>
          ) : null}
        </div>

        {/* Quick Actions Card */}
        <div className="bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-700">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span>⚡</span>
            빠른 작업
          </h2>
          <div className="space-y-3">
            <button
              onClick={handleMorningWords}
              disabled={actionLoading === "morning"}
              className="w-full py-3 px-4 bg-gradient-to-r from-[#667eea] to-[#764ba2] hover:from-[#764ba2] hover:to-[#667eea] text-white font-semibold rounded-lg shadow-lg transition-all hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading === "morning" ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  전송 중...
                </span>
              ) : (
                "📚 아침 단어 보내기"
              )}
            </button>
            <button
              onClick={handleAttendanceCheck}
              disabled={actionLoading === "attendance"}
              className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-lg transition-all hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading === "attendance" ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  처리 중...
                </span>
              ) : (
                "✅ 출석 체크"
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Recent Wrong Words Card */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>❌</span>
            최근 오답 단어
          </h2>
          <Link
            href="/wrong"
            className="text-purple-400 hover:text-purple-300 text-sm font-medium flex items-center gap-1 transition-colors"
          >
            더 보기 →
          </Link>
        </div>
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-700 rounded-lg animate-pulse"></div>
            ))}
          </div>
        ) : recentWrongWords.length > 0 ? (
          <div className="space-y-2">
            {recentWrongWords.map((word, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg hover:bg-gray-900/70 transition-colors"
              >
                <div className="flex-1">
                  <p className="text-white font-semibold">{word.Word}</p>
                  <p className="text-gray-400 text-sm">{word.Meaning}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold border ${getWrongCountBadgeColor(
                      word.WrongCount
                    )}`}
                  >
                    {word.WrongCount}회 틀림
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <span className="text-6xl mb-4 block">🎉</span>
            <p className="text-gray-400 text-lg">
              아직 틀린 단어가 없습니다!
            </p>
            <p className="text-gray-500 text-sm mt-2">
              계속 열심히 학습하세요!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
