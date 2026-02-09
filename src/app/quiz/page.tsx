'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

interface Word {
  Day: number;
  Word: string;
  Meaning: string;
}

interface WordState {
  word: string;
  meaning: string;
  revealed: boolean;
  status: 'pending' | 'memorized' | 'relearn';
}

function QuizContent() {
  const searchParams = useSearchParams();
  const day = searchParams.get('day');
  const email = searchParams.get('email');

  const [words, setWords] = useState<WordState[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ memorized: number; relearn: number } | null>(null);

  useEffect(() => {
    if (!day) return;
    fetch(`/api/words?day=${day}`)
      .then(res => res.json())
      .then((data: Word[]) => {
        setWords(data.map(w => ({
          word: w.Word,
          meaning: w.Meaning,
          revealed: false,
          status: 'pending',
        })));
        setLoading(false);
      })
      .catch(() => {
        setError('단어를 불러오지 못했습니다.');
        setLoading(false);
      });
  }, [day]);

  const revealWord = useCallback((index: number) => {
    setWords(prev => prev.map((w, i) => i === index ? { ...w, revealed: true } : w));
  }, []);

  const markWord = useCallback((index: number, status: 'memorized' | 'relearn') => {
    setWords(prev => prev.map((w, i) => i === index ? { ...w, status } : w));
  }, []);

  const markAllRelearn = useCallback(() => {
    setWords(prev => prev.map(w => ({ ...w, revealed: true, status: 'relearn' })));
  }, []);

  const allMarked = words.every(w => w.status !== 'pending');

  const handleSubmit = async () => {
    if (!email || !day) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          day: parseInt(day),
          quiz_type: 'lunch', // Can be changed to morning/evening as needed
          results: words.map(w => ({
            word: w.word,
            meaning: w.meaning,
            memorized: w.status === 'memorized',
          })),
        }),
      });
      if (!res.ok) throw new Error('제출 실패');
      const data = await res.json();
      setResult({
        memorized: data.score || words.filter(w => w.status === 'memorized').length,
        relearn: data.relearn || words.filter(w => w.status === 'relearn').length,
      });
      setSubmitted(true);
    } catch {
      setError('제출에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!day || !email) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <p className="text-zinc-500 text-sm">잘못된 접근입니다.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-bounce">🐼</div>
          <p className="text-zinc-500 text-sm" role="status" aria-live="polite">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (submitted && result) {
    return (
      <div className="min-h-screen bg-[#09090b]">
        <div className="max-w-md mx-auto px-4 py-6">
          <div className="text-center py-5">
            <div className="text-5xl mb-2">🐼</div>
            <h1 className="text-zinc-100 text-xl font-bold mb-1">테스트 완료!</h1>
            <p className="text-zinc-500 text-xs">Day {day} 결과</p>
          </div>
          <div className="card p-5 text-center mb-3">
            <div className="flex justify-center gap-8 mb-4">
              <div>
                <div className="text-3xl font-bold text-emerald-400">{result.memorized}</div>
                <div className="text-xs text-zinc-500">외운 단어</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-red-400">{result.relearn}</div>
                <div className="text-xs text-zinc-500">재학습</div>
              </div>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${(result.memorized / words.length) * 100}%` }}
                role="progressbar"
                aria-valuenow={(result.memorized / words.length) * 100}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
            <p className="text-zinc-400 text-xs mt-2">
              {result.memorized}/{words.length} 정답
            </p>
          </div>
          {result.relearn > 0 && (
            <div className="card p-4 border-red-900">
              <h3 className="text-red-400 text-sm font-semibold mb-2">재학습 단어</h3>
              {words.filter(w => w.status === 'relearn').map((w, i) => (
                <div key={i} className="flex justify-between py-1.5 border-b border-zinc-800 last:border-0">
                  <span className="text-zinc-100 text-sm">{w.word}</span>
                  <span className="text-zinc-400 text-xs">{w.meaning}</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-center text-zinc-600 text-xs mt-4">
            저녁 복습에서 결과가 반영됩니다
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b]">
      <div className="max-w-md mx-auto px-3 py-4">
        {/* Header */}
        <div className="text-center py-3">
          <div className="text-3xl mb-1">🐼</div>
          <h1 className="text-zinc-100 text-lg font-bold mb-0.5">Day {day} 단어 테스트</h1>
          <p className="text-zinc-500 text-xs">
            단어를 눌러 뜻을 확인하고, 외웠는지 체크하세요
          </p>
        </div>

        {/* Bulk re-learn */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={markAllRelearn}
            className="flex-1 bg-red-900 text-red-400 border-none rounded-lg py-2.5 text-xs font-semibold cursor-pointer hover:bg-red-800 active:scale-[0.98] transition-all"
            aria-label="전체 재학습 표시"
          >
            전체 재학습
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20" role="alert">
            <p className="text-red-400 text-xs text-center">{error}</p>
          </div>
        )}

        {/* Word Cards */}
        {words.map((w, i) => (
          <div
            key={i}
            className={`card p-3.5 mb-2 ${
              w.status === 'memorized'
                ? 'border-emerald-700'
                : w.status === 'relearn'
                ? 'border-red-900'
                : ''
            }`}
          >
            <div className={`flex items-center justify-between ${w.revealed ? 'mb-2' : ''}`}>
              <div className="flex items-center gap-2">
                <span className="bg-zinc-800 text-zinc-400 w-5 h-5 rounded-full inline-flex items-center justify-center text-[11px] font-bold">
                  {i + 1}
                </span>
                <span className="text-zinc-100 text-base font-semibold">{w.word}</span>
              </div>
              {!w.revealed && (
                <button
                  onClick={() => revealWord(i)}
                  className="bg-zinc-800 text-zinc-400 border-none rounded-md px-2.5 py-1 text-xs cursor-pointer hover:bg-zinc-700 active:scale-95 transition-all"
                  aria-label={`${w.word} 정답 보기`}
                >
                  정답 보기
                </button>
              )}
              {w.revealed && w.status !== 'pending' && (
                <span
                  className={`text-xs font-semibold ${
                    w.status === 'memorized' ? 'text-emerald-400' : 'text-red-400'
                  }`}
                  role="status"
                >
                  {w.status === 'memorized' ? '외움' : '재학습'}
                </span>
              )}
            </div>

            {w.revealed && (
              <>
                <div className="bg-[#09090b] rounded-md p-2 px-3 mb-2">
                  <span className="text-amber-500 text-sm">{w.meaning}</span>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => markWord(i, 'memorized')}
                    className={`flex-1 border rounded-md py-2 text-xs font-semibold cursor-pointer transition-all hover:scale-[1.02] active:scale-95 ${
                      w.status === 'memorized'
                        ? 'bg-emerald-900 text-emerald-400 border-emerald-500'
                        : 'bg-zinc-900 text-zinc-500 border-zinc-700 hover:border-zinc-600'
                    }`}
                    aria-label={`${w.word} 외웠어요`}
                  >
                    외웠어요
                  </button>
                  <button
                    onClick={() => markWord(i, 'relearn')}
                    className={`flex-1 border rounded-md py-2 text-xs font-semibold cursor-pointer transition-all hover:scale-[1.02] active:scale-95 ${
                      w.status === 'relearn'
                        ? 'bg-red-900 text-red-400 border-red-500'
                        : 'bg-zinc-900 text-zinc-500 border-zinc-700 hover:border-zinc-600'
                    }`}
                    aria-label={`${w.word} 재학습`}
                  >
                    재학습
                  </button>
                </div>
              </>
            )}
          </div>
        ))}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!allMarked || submitting}
          className={`w-full mt-3 mb-4 rounded-xl py-3.5 text-sm font-bold transition-all ${
            allMarked
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white cursor-pointer hover:opacity-90 active:scale-[0.98]'
              : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
          } ${submitting ? 'opacity-60' : ''}`}
          aria-label={allMarked ? '결과 제출하기' : `${words.filter(w => w.status === 'pending').length}개 남음`}
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              제출 중...
            </span>
          ) : allMarked ? (
            '결과 제출하기'
          ) : (
            `${words.filter(w => w.status === 'pending').length}개 남음`
          )}
        </button>

        <p className="text-center text-zinc-600 text-[11px] mb-0 pb-4">
          옛설판다 · 비즈니스 영어 마스터
        </p>
      </div>
    </div>
  );
}

export default function QuizPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-bounce">🐼</div>
          <p className="text-zinc-500 text-sm">로딩 중...</p>
        </div>
      </div>
    }>
      <QuizContent />
    </Suspense>
  );
}
