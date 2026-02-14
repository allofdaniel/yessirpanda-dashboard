'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Image from 'next/image';

interface Word {
  Word: string;
  Meaning: string;
}

interface Config {
  CurrentDay: string;
  TotalDays: string;
}

function KakaoContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  // const mode = searchParams.get('mode') || 'words'; // words | test | review - reserved for future use

  const [config, setConfig] = useState<Config | null>(null);
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [configRes, wordsRes] = await Promise.all([
        fetch('/api/config'),
        fetch('/api/words'),
      ]);
      if (!configRes.ok || !wordsRes.ok) throw new Error('Failed');
      const configData = await configRes.json();
      const allWords = await wordsRes.json();
      setConfig(configData);

      const currentDay = parseInt(configData.CurrentDay || '1');
      const todayWords = allWords.filter((w: { Day: number }) => w.Day === currentDay);
      setWords(todayWords);
    } catch {
      setError('데이터를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const currentDay = parseInt(config?.CurrentDay || '1');
  const totalDays = parseInt(config?.TotalDays || '10');

  if (loading) {
    return (
      <div style={styles.center}>
        <div style={styles.spinner} />
        <p style={{ color: '#71717a', fontSize: 14, marginTop: 12 }}>로딩 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.center}>
        <p style={{ color: '#f87171', fontSize: 14 }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <Image src="/2.png" alt="옛설판다" width={48} height={48} priority />
          <h1 style={styles.title}>옛설판다</h1>
          <p style={styles.subtitle}>비즈니스 영어 마스터</p>
          <div style={styles.dayBadge}>
            Day {currentDay} / {totalDays}
          </div>
        </div>

        {/* Today's Words */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>📚 오늘의 단어 ({words.length}개)</h2>
          </div>
          <div style={styles.cardBody}>
            {words.length === 0 ? (
              <p style={{ color: '#71717a', textAlign: 'center', padding: 20 }}>
                오늘의 단어가 없습니다.
              </p>
            ) : (
              words.map((w, i) => (
                <div key={i} style={styles.wordRow}>
                  <div style={styles.wordNum}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={styles.wordText}>{w.Word}</div>
                    <div style={styles.meaningText}>{w.Meaning}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
          <a
            href={`/quiz?day=${currentDay}&email=${encodeURIComponent(email)}`}
            style={styles.primaryBtn}
          >
            ✏️ 단어 테스트 시작
          </a>
          <a
            href={`/login`}
            style={styles.secondaryBtn}
          >
            📊 대시보드에서 관리
          </a>
        </div>

        {/* Tips */}
        <div style={{ ...styles.card, marginTop: 16 }}>
          <div style={styles.cardBody}>
            <h3 style={{ color: '#f4f4f5', fontSize: 14, margin: '0 0 8px' }}>💡 학습 팁</h3>
            <ul style={{ color: '#a1a1aa', fontSize: 13, margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
              <li>단어를 3번씩 소리 내어 읽어보세요</li>
              <li>비즈니스 상황을 상상하며 외우세요</li>
              <li>테스트로 암기 상태를 확인하세요</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <p style={styles.footer}>옛설판다 · 매일 성장하는 비즈니스 영어</p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#09090b',
    fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
  },
  container: {
    maxWidth: 480,
    margin: '0 auto',
    padding: '16px 14px',
  },
  center: {
    minHeight: '100vh',
    background: '#09090b',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    width: 32,
    height: 32,
    border: '3px solid #27272a',
    borderTopColor: '#8b5cf6',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  header: {
    textAlign: 'center',
    padding: '16px 0 20px',
  },
  title: {
    color: '#f4f4f5',
    fontSize: 22,
    fontWeight: 800,
    margin: '4px 0 2px',
  },
  subtitle: {
    color: '#71717a',
    fontSize: 13,
    margin: '0 0 12px',
  },
  dayBadge: {
    display: 'inline-block',
    background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
    color: '#fff',
    padding: '6px 18px',
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 700,
  },
  card: {
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardHeader: {
    padding: '12px 16px',
    borderBottom: '1px solid #27272a',
    background: 'linear-gradient(135deg, #8b5cf620, #6d28d910)',
  },
  cardTitle: {
    color: '#f4f4f5',
    fontSize: 15,
    fontWeight: 700,
    margin: 0,
  },
  cardBody: {
    padding: '8px 12px',
  },
  wordRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 4px',
    borderBottom: '1px solid #1e1e22',
  },
  wordNum: {
    width: 26,
    height: 26,
    borderRadius: '50%',
    background: '#27272a',
    color: '#a1a1aa',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    flexShrink: 0,
  },
  wordText: {
    color: '#f4f4f5',
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 2,
  },
  meaningText: {
    color: '#a1a1aa',
    fontSize: 13,
  },
  primaryBtn: {
    display: 'block',
    background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
    color: '#fff',
    textDecoration: 'none',
    padding: '14px 0',
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 700,
    textAlign: 'center',
  },
  secondaryBtn: {
    display: 'block',
    background: '#18181b',
    border: '1px solid #3f3f46',
    color: '#a1a1aa',
    textDecoration: 'none',
    padding: '12px 0',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    textAlign: 'center',
  },
  footer: {
    textAlign: 'center',
    color: '#52525b',
    fontSize: 12,
    marginTop: 20,
    paddingBottom: 16,
  },
};

export default function KakaoPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', background: '#09090b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: '#71717a', fontSize: 14 }}>로딩 중...</p>
        </div>
      }
    >
      <KakaoContent />
    </Suspense>
  );
}
