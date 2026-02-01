"use client";

import { useEffect, useState } from "react";

interface Config {
  CurrentDay: number;
  TotalDays: number;
  WordsPerDay: number;
}

interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  emoji: string;
  gradient: string;
}

export default function ControlPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [currentDay, setCurrentDay] = useState(1);
  const [wordsPerDay, setWordsPerDay] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggeringWorkflows, setTriggeringWorkflows] = useState<Set<string>>(
    new Set()
  );
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const workflows: Workflow[] = [
    {
      id: "morning-words",
      name: "아침 단어",
      description: "오늘의 비즈니스 영어 단어 + 예문 발송",
      emoji: "🌅",
      gradient: "from-orange-500 to-amber-500",
    },
    {
      id: "morning-test",
      name: "아침 테스트",
      description: "학습 단어 테스트 발송",
      emoji: "✏️",
      gradient: "from-blue-500 to-cyan-500",
    },
    {
      id: "lunch-test",
      name: "점심 테스트",
      description: "오전 학습 단어 복습 테스트 발송",
      emoji: "🍽️",
      gradient: "from-emerald-500 to-teal-500",
    },
    {
      id: "evening-review",
      name: "저녁 복습",
      description: "오늘의 오답 노트 + 복습 자료 발송",
      emoji: "🌙",
      gradient: "from-purple-500 to-violet-500",
    },
  ];

  const wordCountOptions = [5, 10, 15, 20, 25, 30];

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/config");
      if (!response.ok) throw new Error("Failed to fetch config");
      const data = await response.json();
      const parsed = {
        CurrentDay: parseInt(data.CurrentDay) || 1,
        TotalDays: parseInt(data.TotalDays) || 1,
        WordsPerDay: parseInt(data.WordsPerDay) || 10,
      };
      setConfig(parsed);
      setCurrentDay(parsed.CurrentDay);
      setWordsPerDay(parsed.WordsPerDay);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "데이터를 불러올 수 없습니다");
    } finally {
      setLoading(false);
    }
  };

  const triggerWorkflow = async (workflowId: string) => {
    setTriggeringWorkflows((prev) => new Set(prev).add(workflowId));
    try {
      const response = await fetch("/api/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflow: workflowId }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.details || data.error || "실행 실패");
      }

      addToast("워크플로우가 실행되었습니다", "success");
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "워크플로우 실행 실패",
        "error"
      );
    } finally {
      setTriggeringWorkflows((prev) => {
        const next = new Set(prev);
        next.delete(workflowId);
        return next;
      });
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      // Save CurrentDay
      if (currentDay !== config?.CurrentDay) {
        const res1 = await fetch("/api/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: "CurrentDay", value: currentDay.toString() }),
        });
        if (!res1.ok) throw new Error("CurrentDay 저장 실패");
      }

      // Save WordsPerDay
      if (wordsPerDay !== config?.WordsPerDay) {
        const res2 = await fetch("/api/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: "WordsPerDay", value: wordsPerDay.toString() }),
        });
        if (!res2.ok) throw new Error("WordsPerDay 저장 실패");
      }

      setConfig((prev) =>
        prev ? { ...prev, CurrentDay: currentDay, WordsPerDay: wordsPerDay } : prev
      );
      addToast("설정이 저장되었습니다", "success");
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "설정 저장 실패",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  const resetToDay1 = async () => {
    setResetting(true);
    try {
      const response = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "CurrentDay", value: "1" }),
      });
      if (!response.ok) throw new Error("초기화 실패");

      setCurrentDay(1);
      setConfig((prev) => (prev ? { ...prev, CurrentDay: 1 } : prev));
      setShowResetConfirm(false);
      addToast("Day 1로 초기화되었습니다", "success");
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "초기화 실패",
        "error"
      );
    } finally {
      setResetting(false);
    }
  };

  const addToast = (message: string, type: "success" | "error") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  const hasChanges =
    config &&
    (currentDay !== config.CurrentDay || wordsPerDay !== config.WordsPerDay);

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
      <div className="animate-fade-in">
        <h1 className="text-3xl font-bold text-zinc-100 mb-2">제어판</h1>
        <p className="text-zinc-400">
          학습 설정 관리 및 워크플로우 수동 실행
        </p>
      </div>

      {/* Settings Section */}
      <div className="card p-6 animate-fade-in stagger-1">
        <h3 className="text-lg font-semibold text-zinc-100 mb-5">
          학습 설정
        </h3>

        <div className="space-y-5">
          {/* Current Day */}
          <div>
            <label className="text-sm text-zinc-400 mb-2 block">현재 Day</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCurrentDay(Math.max(1, currentDay - 1))}
                className="w-10 h-10 rounded-lg bg-zinc-800 text-zinc-100 hover:bg-zinc-700 transition-all text-lg font-bold"
              >
                -
              </button>
              <div className="flex-1 text-center">
                <span className="text-3xl font-bold text-zinc-100">
                  {currentDay}
                </span>
                <span className="text-zinc-500 text-lg ml-1">
                  / {config?.TotalDays}
                </span>
              </div>
              <button
                onClick={() =>
                  setCurrentDay(
                    Math.min(config?.TotalDays || 100, currentDay + 1)
                  )
                }
                className="w-10 h-10 rounded-lg bg-zinc-800 text-zinc-100 hover:bg-zinc-700 transition-all text-lg font-bold"
              >
                +
              </button>
            </div>
          </div>

          {/* Words Per Day */}
          <div>
            <label className="text-sm text-zinc-400 mb-2 block">
              일일 단어 수
            </label>
            <div className="grid grid-cols-6 gap-2">
              {wordCountOptions.map((count) => (
                <button
                  key={count}
                  onClick={() => setWordsPerDay(count)}
                  className={`py-2 rounded-lg text-sm font-bold transition-all ${
                    wordsPerDay === count
                      ? "bg-amber-500 text-black"
                      : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  }`}
                >
                  {count}개
                </button>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={saveConfig}
              disabled={saving || !hasChanges}
              className="flex-1 py-3 rounded-lg bg-emerald-600 text-white font-medium transition-all hover:bg-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {saving ? "저장 중..." : "설정 저장"}
            </button>
            <button
              onClick={() => setShowResetConfirm(true)}
              className="px-5 py-3 rounded-lg bg-zinc-800 text-red-400 font-medium transition-all hover:bg-red-900/30 border border-zinc-700 hover:border-red-800"
            >
              Day 1 초기화
            </button>
          </div>
        </div>
      </div>

      {/* Workflow Grid */}
      <div className="animate-fade-in stagger-2">
        <h3 className="text-lg font-semibold text-zinc-100 mb-3">
          수동 실행
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {workflows.map((workflow) => (
            <button
              key={workflow.id}
              onClick={() => triggerWorkflow(workflow.id)}
              disabled={triggeringWorkflows.has(workflow.id)}
              className="card p-4 text-left transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              <div className="text-2xl mb-2">{workflow.emoji}</div>
              <div className="text-sm font-semibold text-zinc-100 mb-1">
                {workflow.name}
              </div>
              <div className="text-xs text-zinc-500 leading-tight">
                {triggeringWorkflows.has(workflow.id)
                  ? "실행 중..."
                  : workflow.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Quick Info */}
      <div className="card p-4 bg-violet-500/5 border-violet-500/10 animate-fade-in stagger-3">
        <div className="flex items-center justify-between">
          <div className="text-sm text-zinc-400">
            Day {config?.CurrentDay} / {config?.TotalDays} ·{" "}
            {config?.WordsPerDay}개/일
          </div>
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-violet-400 hover:text-violet-300 transition-all"
          >
            Supabase 열기 →
          </a>
        </div>
      </div>

      {/* Reset Confirm Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="card p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-zinc-100 mb-2">
              정말 초기화할까요?
            </h3>
            <p className="text-zinc-400 text-sm mb-5">
              현재 Day를 1로 되돌립니다. 학습 기록은 유지됩니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2.5 rounded-lg bg-zinc-800 text-zinc-300 font-medium hover:bg-zinc-700 transition-all"
              >
                취소
              </button>
              <button
                onClick={resetToDay1}
                disabled={resetting}
                className="flex-1 py-2.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-all disabled:opacity-50"
              >
                {resetting ? "초기화 중..." : "초기화"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-6 py-3 rounded-lg shadow-lg ${
              toast.type === "success"
                ? "bg-emerald-600 text-white"
                : "bg-red-600 text-white"
            } animate-fade-in`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
