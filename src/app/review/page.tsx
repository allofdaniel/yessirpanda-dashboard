'use client';

import { useEffect, useState, useCallback } from 'react';
import { createAuthBrowserClient } from '@/lib/supabase-auth';
import { useRouter } from 'next/navigation';

interface Word {
  Day: number;
  Word: string;
  Meaning: string;
}

interface WrongWord {
  Email: string;
  Word: string;
  Meaning: string;
  WrongCount: number;
  LastWrong: string;
  NextReview: string;
  Mastered: boolean;
}

interface ReviewWord {
  word: string;
  meaning: string;
  source: 'wrong' | 'postponed';
  wrongCount?: number;
  day?: number;
  priority: number; // Higher = shown more often
}

export default function ReviewPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [reviewWords, setReviewWords] = useState<ReviewWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [stats, setStats] = useState({ mastered: 0, needsReview: 0 });

  // Fetch review words from both wrong_words and postponed_days
  const fetchReviewWords = useCallback(async () => {
    try {
      setLoading(true);
      const supabase = createAuthBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      const userEmail = user?.email || '';
      setEmail(userEmail);

      if (!userEmail) {
        router.push('/login');
        return;
      }

      // Fetch wrong words
      const wrongRes = await fetch(`/api/wrong?email=${encodeURIComponent(userEmail)}`);
      const wrongWords: WrongWord[] = await wrongRes.json();

      // Fetch postponed days
      const postponeRes = await fetch(`/api/postpone?email=${encodeURIComponent(userEmail)}`);
      const postponeData = await postponeRes.json();
      const postponedDays: number[] = postponeData.postponedDays || [];

      // Fetch words for postponed days
      const wordsRes = await fetch('/api/words');
      const allWords: Word[] = await wordsRes.json();

      const postponedWords = allWords.filter(w => postponedDays.includes(w.Day));

      // Build review list with priority
      const reviews: ReviewWord[] = [];

      // Add wrong words (not mastered)
      wrongWords
        .filter(w => !w.Mastered)
        .forEach(w => {
          // Priority based on wrong count (higher count = higher priority)
          const priority = Math.min(w.WrongCount * 2, 10);
          reviews.push({
            word: w.Word,
            meaning: w.Meaning,
            source: 'wrong',
            wrongCount: w.WrongCount,
            priority,
          });
        });

      // Add postponed words
      postponedWords.forEach(w => {
        reviews.push({
          word: w.Word,
          meaning: w.Meaning,
          source: 'postponed',
          day: w.Day,
          priority: 1, // Lower priority than wrong words
        });
      });

      if (reviews.length === 0) {
        setError('복습할 단어가 없습니다!');
        setLoading(false);
        return;
      }

      // Shuffle with weighted priority
      const shuffled = weightedShuffle(reviews);
      setReviewWords(shuffled);
      setLoading(false);
    } catch (err) {
      setError('데이터를 불러오는데 실패했습니다.');
      console.error('Error fetching review words:', err);
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchReviewWords();
  }, [fetchReviewWords]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!revealed || completed || loading) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === '1' || e.key.toLowerCase() === 'y') {
        handleKnow();
      } else if (e.key === '2' || e.key.toLowerCase() === 'n') {
        handleDontKnow();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, completed, loading, currentIndex]);

  // Weighted shuffle - words with higher priority appear more often
  const weightedShuffle = (words: ReviewWord[]): ReviewWord[] => {
    const result: ReviewWord[] = [];
    const pool = [...words];

    // Add high-priority words multiple times
    words.forEach(w => {
      for (let i = 0; i < w.priority; i++) {
        pool.push(w);
      }
    });

    // Shuffle the pool
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    // Remove duplicates while maintaining weighted order
    const seen = new Set<string>();
    pool.forEach(w => {
      if (!seen.has(w.word)) {
        seen.add(w.word);
        result.push(w);
      }
    });

    return result;
  };

  const handleReveal = () => {
    setRevealed(true);
  };

  const handleKnow = async () => {
    const currentWord = reviewWords[currentIndex];

    // Update stats
    setStats(prev => ({ ...prev, mastered: prev.mastered + 1 }));

    // If it's a wrong word, mark as mastered
    if (currentWord.source === 'wrong') {
      try {
        await fetch('/api/wrong', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            word: currentWord.word,
            data: { Mastered: true },
          }),
        });
      } catch (err) {
        console.error('Failed to mark word as mastered:', err);
      }
    }

    // If it's a postponed word, remove from postponed list
    if (currentWord.source === 'postponed' && currentWord.day) {
      try {
        await fetch('/api/postpone', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            day: currentWord.day,
          }),
        });
      } catch (err) {
        console.error('Failed to clear postponed day:', err);
      }
    }

    // Remove word from review list
    const newWords = reviewWords.filter((_, idx) => idx !== currentIndex);
    setReviewWords(newWords);

    if (newWords.length === 0) {
      setCompleted(true);
    } else {
      setRevealed(false);
      // Stay at same index if possible, otherwise go to previous
      if (currentIndex >= newWords.length) {
        setCurrentIndex(Math.max(0, newWords.length - 1));
      }
    }
  };

  const handleDontKnow = () => {
    const currentWord = reviewWords[currentIndex];

    // Update stats
    setStats(prev => ({ ...prev, needsReview: prev.needsReview + 1 }));

    // Move word to end of queue with increased priority
    const updatedWord = { ...currentWord, priority: currentWord.priority + 1 };
    const newWords = [
      ...reviewWords.slice(0, currentIndex),
      ...reviewWords.slice(currentIndex + 1),
      updatedWord,
    ];

    setReviewWords(newWords);
    setRevealed(false);

    // Move to next word (or wrap to start)
    if (currentIndex >= newWords.length - 1) {
      setCurrentIndex(0);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-bounce">🐼</div>
          <p className="text-zinc-400">복습 단어를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || reviewWords.length === 0) {
    return (
      <div className="space-y-6">
        <div className="animate-fade-in">
          <h1 className="text-3xl font-bold text-zinc-100 mb-2">📚 복습 모드</h1>
          <p className="text-zinc-400">플래시카드로 단어 복습하기</p>
        </div>

        <div className="card p-12 text-center animate-fade-in stagger-1">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-zinc-100 mb-3">복습할 단어가 없습니다!</h2>
          <p className="text-zinc-400 mb-6">
            오답 노트나 미룬 단어가 생기면<br />이곳에서 집중 복습할 수 있어요.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.push('/wrong')}
              className="btn-accent px-6 py-3"
              aria-label="오답 노트 페이지로 이동"
            >
              오답 노트 보기
            </button>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 rounded-lg bg-zinc-900 text-zinc-300 hover:bg-zinc-800 active:scale-95 transition-all"
              aria-label="홈으로 이동"
            >
              홈으로
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="space-y-6">
        <div className="animate-fade-in">
          <h1 className="text-3xl font-bold text-zinc-100 mb-2">📚 복습 완료!</h1>
          <p className="text-zinc-400">오늘의 복습을 모두 완료했습니다</p>
        </div>

        <div className="card p-12 text-center animate-fade-in stagger-1">
          <div className="text-6xl mb-4">🎊</div>
          <h2 className="text-2xl font-bold text-zinc-100 mb-6">복습 완료!</h2>

          <div className="grid grid-cols-2 gap-4 mb-8 max-w-md mx-auto">
            <div className="card p-6">
              <div className="text-3xl font-bold text-emerald-400 mb-1">{stats.mastered}</div>
              <div className="text-sm text-zinc-400">알았어요</div>
            </div>
            <div className="card p-6">
              <div className="text-3xl font-bold text-amber-400 mb-1">{stats.needsReview}</div>
              <div className="text-sm text-zinc-400">모르겠어요</div>
            </div>
          </div>

          <div className="flex gap-3 justify-center">
            <button
              onClick={fetchReviewWords}
              className="btn-accent px-6 py-3"
              aria-label="복습 다시 시작하기"
            >
              다시 복습하기
            </button>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 rounded-lg bg-zinc-900 text-zinc-300 hover:bg-zinc-800 active:scale-95 transition-all"
              aria-label="홈으로 이동"
            >
              홈으로
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentWord = reviewWords[currentIndex];
  const progress = ((stats.mastered) / (stats.mastered + reviewWords.length)) * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-3xl font-bold text-zinc-100 mb-2">📚 복습 모드</h1>
        <p className="text-zinc-400">
          {currentIndex + 1} / {reviewWords.length} 단어 · {stats.mastered}개 마스터
        </p>
      </div>

      {/* Progress Bar */}
      <div className="card p-4 animate-fade-in stagger-1">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-zinc-400">진행률</span>
          <span className="text-sm font-semibold text-violet-400">{progress.toFixed(0)}%</span>
        </div>
        <div className="h-2 bg-zinc-900 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-600 to-pink-600 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`복습 진행률 ${progress.toFixed(0)}%`}
          />
        </div>
      </div>

      {/* Flashcard */}
      <div className="card card-glow p-8 md:p-12 animate-fade-in stagger-2 min-h-[400px] flex flex-col">
        {/* Word Source Badge */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            {currentWord.source === 'wrong' ? (
              <span className="px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold">
                오답 노트 · {currentWord.wrongCount}회
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
                미룬 단어 · Day {currentWord.day}
              </span>
            )}
          </div>
          <button
            onClick={() => router.push('/')}
            className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm"
          >
            나가기
          </button>
        </div>

        {/* Word Display */}
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="mb-8">
            <h2 className="text-5xl md:text-6xl font-bold gradient-text mb-4">
              {currentWord.word}
            </h2>
            <p className="text-zinc-500 text-sm">이 단어의 뜻을 기억하시나요?</p>
          </div>

          {/* Revealed Meaning */}
          {revealed && (
            <div className="mb-8 animate-fade-in">
              <div className="card p-6 bg-violet-600/10 border-violet-500/30 inline-block">
                <p className="text-2xl md:text-3xl text-violet-300 font-semibold">
                  {currentWord.meaning}
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="w-full max-w-md">
            {!revealed ? (
              <button
                onClick={handleReveal}
                className="w-full btn-accent px-8 py-4 text-lg"
              >
                뜻 보기
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={handleDontKnow}
                  className="px-6 py-4 rounded-xl bg-amber-500/10 border-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/20 active:scale-95 transition-all font-semibold"
                  aria-label={`${currentWord.word} 모르겠어요`}
                >
                  모르겠어요
                </button>
                <button
                  onClick={handleKnow}
                  className="px-6 py-4 rounded-xl bg-emerald-500/10 border-2 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 active:scale-95 transition-all font-semibold"
                  aria-label={`${currentWord.word} 알았어요`}
                >
                  알았어요
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Keyboard Shortcuts Hint */}
        {revealed && (
          <div className="text-center text-xs text-zinc-600 mt-4">
            단축키: 1 또는 Y = 알았어요 · 2 또는 N = 모르겠어요
          </div>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4 animate-fade-in stagger-3">
        <div className="card p-5">
          <div className="text-2xl font-bold text-violet-400">{reviewWords.length}</div>
          <div className="text-sm text-zinc-400">남은 단어</div>
        </div>
        <div className="card p-5">
          <div className="text-2xl font-bold text-emerald-400">{stats.mastered}</div>
          <div className="text-sm text-zinc-400">마스터</div>
        </div>
        <div className="card p-5">
          <div className="text-2xl font-bold text-amber-400">{stats.needsReview}</div>
          <div className="text-sm text-zinc-400">재학습</div>
        </div>
      </div>

      {/* Tips Card */}
      <div className="card p-6 animate-fade-in stagger-4">
        <h3 className="text-lg font-semibold text-zinc-100 mb-3">💡 복습 팁</h3>
        <ul className="space-y-2 text-sm text-zinc-400">
          <li className="flex items-start gap-2">
            <span className="text-violet-400 mt-0.5">•</span>
            <span>틀린 횟수가 많을수록 더 자주 나타나요</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-violet-400 mt-0.5">•</span>
            <span>&quot;알았어요&quot;를 누르면 복습 목록에서 제거돼요</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-violet-400 mt-0.5">•</span>
            <span>&quot;모르겠어요&quot;를 누르면 나중에 다시 나와요</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
