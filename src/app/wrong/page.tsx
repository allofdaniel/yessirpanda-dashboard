"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createAuthBrowserClient } from "@/lib/supabase-auth";
import ExportButtons from "@/components/ExportButtons";

interface WrongWord {
  Email: string;
  Word: string;
  Meaning: string;
  WrongCount: number;
  LastWrong: string;
  NextReview: string;
  Mastered: boolean;
}

type FilterType = "전체" | "복습필요" | "마스터";

export default function WrongPage() {
  const [wrongWords, setWrongWords] = useState<WrongWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>("전체");
  const [updatingWords, setUpdatingWords] = useState<Set<string>>(new Set());
  const emailRef = useRef('');

  const fetchWrongWords = useCallback(async () => {
    try {
      setLoading(true);
      if (!emailRef.current) {
        const supabase = createAuthBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        emailRef.current = user?.email || '';
      }
      const response = await fetch(`/api/wrong?email=${encodeURIComponent(emailRef.current)}`);
      if (!response.ok) throw new Error("Failed to fetch wrong words");
      const data = await response.json();
      setWrongWords(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWrongWords(); }, [fetchWrongWords]);

  const toggleMastered = async (word: string, currentMastered: boolean) => {
    setUpdatingWords((prev) => new Set(prev).add(word));
    try {
      const response = await fetch("/api/wrong", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailRef.current,
          word,
          data: { Mastered: !currentMastered },
        }),
      });
      if (!response.ok) throw new Error("Failed to update word");
      await fetchWrongWords();
    } catch (err) {
      console.error("Failed to toggle mastered:", err);
    } finally {
      setUpdatingWords((prev) => {
        const next = new Set(prev);
        next.delete(word);
        return next;
      });
    }
  };

  const filteredWords = wrongWords.filter((w) => {
    if (filter === "복습필요") return !w.Mastered;
    if (filter === "마스터") return w.Mastered;
    return true;
  });

  const masteredCount = wrongWords.filter((w) => w.Mastered).length;
  const todayReviewCount = wrongWords.filter(
    (w) => w.NextReview && new Date(w.NextReview) <= new Date()
  ).length;
  const avgWrongCount =
    wrongWords.length > 0
      ? (
          wrongWords.reduce((sum, w) => sum + w.WrongCount, 0) /
          wrongWords.length
        ).toFixed(1)
      : "0";

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100 mb-2">
            ❌ 오답 노트
          </h1>
          <p className="text-zinc-400">
            총 {wrongWords.length}개 단어 | 마스터 {masteredCount}개
          </p>
        </div>
        {emailRef.current && wrongWords.length > 0 && (
          <ExportButtons
            email={emailRef.current}
            type="wrong"
            label="오답 단어"
          />
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-3 animate-fade-in stagger-1">
        {(["전체", "복습필요", "마스터"] as FilterType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2 rounded-lg transition-all ${
              filter === tab
                ? "bg-violet-600 text-white"
                : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Spaced Repetition Info */}
      <div className="card p-5 animate-fade-in stagger-2">
        <h3 className="text-lg font-semibold text-zinc-100 mb-3">
          📚 복습 주기 시스템
        </h3>
        <div className="space-y-2 text-sm text-zinc-400">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>1회 오답: 다음 날 복습</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span>2회 오답: 3일 후 복습</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span>3회 이상: 7일 후 복습</span>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4 animate-fade-in stagger-3">
        <div className="card p-5">
          <div className="text-2xl font-bold text-zinc-100">
            {wrongWords.length}
          </div>
          <div className="text-sm text-zinc-400">전체 오답</div>
        </div>
        <div className="card p-5">
          <div className="text-2xl font-bold text-pink-500">
            {todayReviewCount}
          </div>
          <div className="text-sm text-zinc-400">오늘 복습</div>
        </div>
        <div className="card p-5">
          <div className="text-2xl font-bold text-violet-500">
            {avgWrongCount}
          </div>
          <div className="text-sm text-zinc-400">평균 오답</div>
        </div>
      </div>

      {/* Word List */}
      <div className="space-y-3">
        {filteredWords.length === 0 ? (
          <div className="card p-6 text-center text-zinc-600">
            {filter === "마스터"
              ? "아직 마스터한 단어가 없습니다"
              : "오답 단어가 없습니다"}
          </div>
        ) : (
          filteredWords.map((word, idx) => (
            <div
              key={word.Word}
              className={`card p-5 animate-fade-in stagger-${Math.min(idx, 5)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold text-zinc-100">
                      {word.Word}
                    </h3>
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        word.WrongCount >= 3
                          ? "bg-red-500/20 text-red-400"
                          : word.WrongCount === 2
                          ? "bg-yellow-500/20 text-yellow-400"
                          : "bg-green-500/20 text-green-400"
                      }`}
                    >
                      {word.WrongCount}회
                    </span>
                    {word.Mastered && (
                      <span className="px-2 py-1 rounded text-xs font-semibold bg-violet-500/20 text-violet-400">
                        마스터
                      </span>
                    )}
                  </div>
                  <p className="text-zinc-400 mb-3">{word.Meaning}</p>
                  <div className="flex gap-4 text-sm text-zinc-600">
                    <span>마지막 오답: {word.LastWrong}</span>
                    <span>다음 복습: {word.NextReview}</span>
                  </div>
                </div>
                <button
                  onClick={() => toggleMastered(word.Word, word.Mastered)}
                  disabled={updatingWords.has(word.Word)}
                  className={`px-4 py-2 rounded-lg transition-all ${
                    word.Mastered
                      ? "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                      : "bg-gradient-to-r from-violet-500 to-pink-500 text-white hover:opacity-90"
                  } disabled:opacity-50`}
                >
                  {updatingWords.has(word.Word)
                    ? "..."
                    : word.Mastered
                    ? "마스터 취소"
                    : "마스터 처리"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
