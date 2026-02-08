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
      <div style={{ minHeight: '100vh', background: '#09090b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#71717a', fontSize: 15 }}>잘못된 접근입니다.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#09090b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#71717a', fontSize: 15 }}>로딩 중...</p>
      </div>
    );
  }

  if (submitted && result) {
    return (
      <div style={{ minHeight: '100vh', background: '#09090b', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" }}>
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px' }}>
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🐼</div>
            <h1 style={{ color: '#f4f4f5', fontSize: 20, margin: '0 0 4px' }}>테스트 완료!</h1>
            <p style={{ color: '#71717a', fontSize: 13, margin: 0 }}>Day {day} 결과</p>
          </div>
          <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 12, padding: 20, textAlign: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 32, fontWeight: 700, color: '#10b981' }}>{result.memorized}</div>
                <div style={{ fontSize: 13, color: '#71717a' }}>외운 단어</div>
              </div>
              <div>
                <div style={{ fontSize: 32, fontWeight: 700, color: '#f87171' }}>{result.relearn}</div>
                <div style={{ fontSize: 13, color: '#71717a' }}>재학습</div>
              </div>
            </div>
            <div style={{ background: '#27272a', borderRadius: 8, height: 8, overflow: 'hidden' }}>
              <div style={{ background: '#10b981', height: '100%', width: `${(result.memorized / words.length) * 100}%`, borderRadius: 8 }} />
            </div>
            <p style={{ color: '#a1a1aa', fontSize: 13, margin: '8px 0 0' }}>
              {result.memorized}/{words.length} 정답
            </p>
          </div>
          {result.relearn > 0 && (
            <div style={{ background: '#18181b', border: '1px solid #7f1d1d', borderRadius: 12, padding: 16 }}>
              <h3 style={{ color: '#f87171', fontSize: 14, margin: '0 0 8px' }}>재학습 단어</h3>
              {words.filter(w => w.status === 'relearn').map((w, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #27272a' }}>
                  <span style={{ color: '#f4f4f5', fontSize: 14 }}>{w.word}</span>
                  <span style={{ color: '#a1a1aa', fontSize: 13 }}>{w.meaning}</span>
                </div>
              ))}
            </div>
          )}
          <p style={{ textAlign: 'center', color: '#52525b', fontSize: 12, marginTop: 16 }}>
            저녁 복습에서 결과가 반영됩니다
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#09090b', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '16px 12px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <div style={{ fontSize: 32, marginBottom: 4 }}>🐼</div>
          <h1 style={{ color: '#f4f4f5', fontSize: 18, margin: '0 0 2px' }}>Day {day} 단어 테스트</h1>
          <p style={{ color: '#71717a', fontSize: 12, margin: 0 }}>
            단어를 눌러 뜻을 확인하고, 외웠는지 체크하세요
          </p>
        </div>

        {/* Bulk re-learn */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button
            onClick={markAllRelearn}
            style={{ flex: 1, background: '#7f1d1d', color: '#f87171', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            전체 재학습
          </button>
        </div>

        {error && <p style={{ color: '#f87171', fontSize: 13, textAlign: 'center' }}>{error}</p>}

        {/* Word Cards */}
        {words.map((w, i) => (
          <div key={i} style={{ background: '#18181b', border: `1px solid ${w.status === 'memorized' ? '#065f46' : w.status === 'relearn' ? '#7f1d1d' : '#27272a'}`, borderRadius: 10, padding: '12px 14px', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: w.revealed ? 8 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: '#27272a', color: '#a1a1aa', width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{i + 1}</span>
                <span style={{ color: '#f4f4f5', fontSize: 16, fontWeight: 600 }}>{w.word}</span>
              </div>
              {!w.revealed && (
                <button
                  onClick={() => revealWord(i)}
                  style={{ background: '#27272a', color: '#a1a1aa', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer' }}
                >
                  정답 보기
                </button>
              )}
              {w.revealed && w.status !== 'pending' && (
                <span style={{ fontSize: 12, color: w.status === 'memorized' ? '#10b981' : '#f87171' }}>
                  {w.status === 'memorized' ? '외움' : '재학습'}
                </span>
              )}
            </div>

            {w.revealed && (
              <>
                <div style={{ background: '#09090b', borderRadius: 6, padding: '8px 12px', marginBottom: 8 }}>
                  <span style={{ color: '#f59e0b', fontSize: 14 }}>{w.meaning}</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => markWord(i, 'memorized')}
                    style={{ flex: 1, background: w.status === 'memorized' ? '#065f46' : '#18181b', color: w.status === 'memorized' ? '#10b981' : '#71717a', border: `1px solid ${w.status === 'memorized' ? '#10b981' : '#3f3f46'}`, borderRadius: 6, padding: '8px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    외웠어요
                  </button>
                  <button
                    onClick={() => markWord(i, 'relearn')}
                    style={{ flex: 1, background: w.status === 'relearn' ? '#7f1d1d' : '#18181b', color: w.status === 'relearn' ? '#f87171' : '#71717a', border: `1px solid ${w.status === 'relearn' ? '#f87171' : '#3f3f46'}`, borderRadius: 6, padding: '8px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
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
          style={{
            width: '100%', marginTop: 12, marginBottom: 16,
            background: allMarked ? 'linear-gradient(135deg,#10b981,#14b8a6)' : '#27272a',
            color: allMarked ? '#fff' : '#52525b',
            border: 'none', borderRadius: 10, padding: '14px 0',
            fontSize: 15, fontWeight: 700, cursor: allMarked ? 'pointer' : 'default',
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? '제출 중...' : allMarked ? '결과 제출하기' : `${words.filter(w => w.status === 'pending').length}개 남음`}
        </button>

        <p style={{ textAlign: 'center', color: '#52525b', fontSize: 11, margin: 0, paddingBottom: 16 }}>
          옛설판다 · 비즈니스 영어 마스터
        </p>
      </div>
    </div>
  );
}

export default function QuizPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#09090b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#71717a', fontSize: 15 }}>로딩 중...</p>
      </div>
    }>
      <QuizContent />
    </Suspense>
  );
}
