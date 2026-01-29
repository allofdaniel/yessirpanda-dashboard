"use client";

import { useEffect, useState } from "react";

interface Config {
  CurrentDay: number;
  TotalDays: number;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggeringWorkflows, setTriggeringWorkflows] = useState<Set<string>>(
    new Set()
  );
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const workflows: Workflow[] = [
    {
      id: "morning-words",
      name: "아침 단어 보내기",
      description: "오늘의 새로운 단어 10개를 카카오톡으로 전송",
      emoji: "🌅",
      gradient: "from-orange-500 to-amber-500",
    },
    {
      id: "morning-test",
      name: "아침 테스트",
      description: "어제 학습한 단어로 테스트 진행",
      emoji: "✏️",
      gradient: "from-blue-500 to-cyan-500",
    },
    {
      id: "lunch-test",
      name: "점심 테스트",
      description: "오전에 학습한 단어로 복습 테스트",
      emoji: "🍽️",
      gradient: "from-emerald-500 to-teal-500",
    },
    {
      id: "evening-review",
      name: "저녁 복습",
      description: "오늘의 오답 노트와 복습 자료 전송",
      emoji: "🌙",
      gradient: "from-purple-500 to-violet-500",
    },
  ];

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/config");
      if (!response.ok) throw new Error("Failed to fetch config");
      const data = await response.json();
      setConfig(data);
      setCurrentDay(data.CurrentDay);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const triggerWorkflow = async (workflowId: string) => {
    setTriggeringWorkflows((prev) => new Set(prev).add(workflowId));
    try {
      const response = await fetch("/api/n8n/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflow: workflowId }),
      });

      if (!response.ok) throw new Error("Failed to trigger workflow");

      addToast(`${workflowId} 워크플로우가 실행되었습니다`, "success");
    } catch (err) {
      addToast(
        `워크플로우 실행 실패: ${
          err instanceof Error ? err.message : "Unknown error"
        }`,
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
      const response = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "CurrentDay",
          value: currentDay.toString(),
        }),
      });

      if (!response.ok) throw new Error("Failed to save config");

      const data = await response.json();
      setConfig(data);
      addToast("설정이 저장되었습니다", "success");
    } catch (err) {
      addToast(
        `설정 저장 실패: ${
          err instanceof Error ? err.message : "Unknown error"
        }`,
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  const addToast = (message: string, type: "success" | "error") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

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
        <h1 className="text-3xl font-bold text-zinc-100 mb-2">
          ⚙️ n8n 제어판
        </h1>
        <p className="text-zinc-400">워크플로우를 수동으로 실행하세요</p>
      </div>

      {/* Workflow Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in stagger-1">
        {workflows.map((workflow, idx) => (
          <div key={workflow.id} className={`card p-6 animate-fade-in stagger-${idx + 1}`}>
            <div className="text-4xl mb-3">{workflow.emoji}</div>
            <h3 className="text-lg font-semibold text-zinc-100 mb-1">
              {workflow.name}
            </h3>
            <p className="text-zinc-500 text-sm mb-4">{workflow.description}</p>
            <button
              onClick={() => triggerWorkflow(workflow.id)}
              disabled={triggeringWorkflows.has(workflow.id)}
              className={`w-full rounded-lg px-4 py-2 bg-gradient-to-r ${workflow.gradient} text-white font-medium transition-all hover:opacity-90 disabled:opacity-50`}
            >
              {triggeringWorkflows.has(workflow.id) ? "실행 중..." : "실행"}
            </button>
          </div>
        ))}
      </div>

      {/* Config Editor */}
      <div className="card p-6 animate-fade-in stagger-5">
        <h3 className="text-lg font-semibold text-zinc-100 mb-4">
          설정 편집
        </h3>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="text-sm text-zinc-400 mb-2 block">
              현재 Day
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentDay(Math.max(1, currentDay - 1))}
                className="w-10 h-10 rounded-lg bg-zinc-800 text-zinc-100 hover:bg-zinc-700 transition-all"
              >
                -
              </button>
              <div className="flex-1 text-center text-2xl font-bold text-zinc-100">
                {currentDay}
              </div>
              <button
                onClick={() =>
                  setCurrentDay(
                    Math.min(config?.TotalDays || 100, currentDay + 1)
                  )
                }
                className="w-10 h-10 rounded-lg bg-zinc-800 text-zinc-100 hover:bg-zinc-700 transition-all"
              >
                +
              </button>
            </div>
          </div>
          <button
            onClick={saveConfig}
            disabled={saving || currentDay === config?.CurrentDay}
            className="px-6 py-3 rounded-lg bg-emerald-600 text-white font-medium transition-all hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>

      {/* Quick Info */}
      <div className="card p-5 bg-violet-500/5 border-violet-500/10 animate-fade-in stagger-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-zinc-400 mb-1">현재 진행도</div>
            <div className="text-xl font-bold text-zinc-100">
              Day {config?.CurrentDay} / {config?.TotalDays}
            </div>
          </div>
          <a
            href="https://n8n.io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-violet-400 hover:text-violet-300 transition-all"
          >
            n8n 워크스페이스 열기 →
          </a>
        </div>
      </div>

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
