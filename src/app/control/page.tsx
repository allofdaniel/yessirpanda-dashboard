'use client';

import { useEffect, useState } from 'react';

interface Config {
  CurrentDay: string;
  TotalDays: string;
  SpreadsheetId?: string;
}

interface WorkflowCard {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
}

const workflows: WorkflowCard[] = [
  {
    id: 'morning-words',
    name: '아침 단어 보내기',
    description: '오늘의 단어 이메일 발송',
    icon: '🌅',
    color: 'from-orange-600 to-yellow-500',
  },
  {
    id: 'morning-test',
    name: '아침 테스트',
    description: '아침 단어 테스트 발송',
    icon: '📝',
    color: 'from-blue-600 to-cyan-500',
  },
  {
    id: 'lunch-test',
    name: '점심 테스트',
    description: '점심 복습 테스트 발송',
    icon: '🍽️',
    color: 'from-green-600 to-emerald-500',
  },
  {
    id: 'evening-review',
    name: '저녁 복습',
    description: '하루 마무리 복습 발송',
    icon: '🌙',
    color: 'from-purple-600 to-indigo-500',
  },
];

export default function ControlPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDay, setCurrentDay] = useState<number>(1);
  const [triggeringWorkflows, setTriggeringWorkflows] = useState<Set<string>>(
    new Set()
  );
  const [cooldowns, setCooldowns] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchConfig() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/config');
        if (!response.ok) {
          throw new Error('Failed to fetch config');
        }

        const data = await response.json();
        setConfig(data);
        setCurrentDay(parseInt(data.CurrentDay));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load config');
      } finally {
        setLoading(false);
      }
    }

    fetchConfig();
  }, []);

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  };

  const handleTriggerWorkflow = async (workflowId: string) => {
    if (triggeringWorkflows.has(workflowId) || cooldowns.has(workflowId)) {
      return;
    }

    try {
      setTriggeringWorkflows((prev) => new Set(prev).add(workflowId));

      const response = await fetch('/api/n8n/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ workflow: workflowId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to trigger workflow');
      }

      showToast(`${workflows.find((w) => w.id === workflowId)?.name} 실행 성공!`, 'success');

      // Start cooldown
      setCooldowns((prev) => new Set(prev).add(workflowId));
      setTimeout(() => {
        setCooldowns((prev) => {
          const next = new Set(prev);
          next.delete(workflowId);
          return next;
        });
      }, 5000);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to trigger workflow',
        'error'
      );
    } finally {
      setTriggeringWorkflows((prev) => {
        const next = new Set(prev);
        next.delete(workflowId);
        return next;
      });
    }
  };

  const handleSaveConfig = async () => {
    try {
      setSaving(true);

      const response = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key: 'CurrentDay',
          value: currentDay.toString(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save config');
      }

      const data = await response.json();
      setConfig((prev) => ({
        ...prev!,
        CurrentDay: currentDay.toString(),
      }));

      showToast('설정이 저장되었습니다', 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to save config',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDayChange = (delta: number) => {
    const newDay = currentDay + delta;
    const totalDays = config ? parseInt(config.TotalDays) : 1;

    if (newDay >= 1 && newDay <= totalDays) {
      setCurrentDay(newDay);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  const totalDays = config ? parseInt(config.TotalDays) : 1;

  return (
    <div className="space-y-6">
        {/* Header */}
        <h1 className="text-3xl font-bold mb-6">⚙️ n8n 제어판</h1>

        {/* Workflow Trigger Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {workflows.map((workflow) => (
            <div
              key={workflow.id}
              className="bg-gray-800/50 rounded-lg p-6 border border-gray-700"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="text-4xl">{workflow.icon}</div>
                <button
                  onClick={() => handleTriggerWorkflow(workflow.id)}
                  disabled={
                    triggeringWorkflows.has(workflow.id) ||
                    cooldowns.has(workflow.id)
                  }
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    triggeringWorkflows.has(workflow.id) || cooldowns.has(workflow.id)
                      ? 'bg-gray-600 cursor-not-allowed'
                      : `bg-gradient-to-r ${workflow.color} hover:opacity-80`
                  }`}
                >
                  {triggeringWorkflows.has(workflow.id) ? (
                    <span className="flex items-center gap-2">
                      <svg
                        className="animate-spin h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      실행중
                    </span>
                  ) : cooldowns.has(workflow.id) ? (
                    '대기중...'
                  ) : (
                    '실행'
                  )}
                </button>
              </div>
              <h3 className="text-xl font-semibold mb-2">{workflow.name}</h3>
              <p className="text-gray-400 text-sm">{workflow.description}</p>
            </div>
          ))}
        </div>

        {/* Config Editor Card */}
        <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
          <h2 className="text-xl font-semibold mb-4">설정 편집</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                현재 Day
              </label>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => handleDayChange(-1)}
                  disabled={currentDay <= 1}
                  className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed px-4 py-2 rounded-lg font-bold text-xl transition-colors"
                >
                  -
                </button>
                <div className="flex-1 text-center">
                  <span className="text-4xl font-bold">{currentDay}</span>
                  <span className="text-gray-400 ml-2">/ {totalDays}</span>
                </div>
                <button
                  onClick={() => handleDayChange(1)}
                  disabled={currentDay >= totalDays}
                  className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed px-4 py-2 rounded-lg font-bold text-xl transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">
                전체 Days
              </label>
              <div className="bg-gray-700/50 px-4 py-3 rounded-lg text-center">
                <span className="text-2xl font-semibold">{totalDays}</span>
                <span className="text-gray-400 text-sm ml-2">일</span>
              </div>
            </div>

            <button
              onClick={handleSaveConfig}
              disabled={
                saving || currentDay === parseInt(config?.CurrentDay || '1')
              }
              className="w-full bg-gradient-to-r from-green-600 to-emerald-500 hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-semibold transition-all"
            >
              {saving ? '저장중...' : '저장'}
            </button>
          </div>
        </div>

        {/* Quick Info Card */}
        <div className="bg-gradient-to-br from-purple-900/40 to-indigo-900/40 rounded-lg p-6 border border-purple-700/50">
          <h2 className="text-xl font-semibold mb-4">빠른 정보</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-300">현재 진행</span>
              <span className="text-xl font-bold">
                Day {config?.CurrentDay} / {config?.TotalDays}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-300">n8n Workspace</span>
              <a
                href="https://allofdaniel.app.n8n.cloud"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1"
              >
                열기
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            </div>
          </div>
        </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-28 left-1/2 transform -translate-x-1/2 z-50 animate-slide-up">
          <div
            className={`px-6 py-3 rounded-lg shadow-lg ${
              toast.type === 'success'
                ? 'bg-green-600 text-white'
                : 'bg-red-600 text-white'
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translate(-50%, 20px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
