'use client';

import { useState, useEffect } from 'react';

interface WrongWord {
  email: string;
  word: string;
  meaning: string;
  wrongCount: number;
  lastWrong: string;
  nextReview: string;
  mastered: boolean;
}

type FilterType = '전체' | '복습필요' | '마스터';

export default function WrongWordsPage() {
  const [wrongWords, setWrongWords] = useState<WrongWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('전체');
  const [updatingWords, setUpdatingWords] = useState<Set<string>>(new Set());

  const email = 'allofdaniel1@gmail.com';

  useEffect(() => {
    fetchWrongWords();
  }, []);

  const fetchWrongWords = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/wrong?email=${email}`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setWrongWords(data);
    } catch (error) {
      console.error('Error fetching wrong words:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleMastered = async (word: string, currentMastered: boolean) => {
    try {
      setUpdatingWords(prev => new Set(prev).add(word));

      const response = await fetch('/api/wrong', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          word,
          data: { mastered: !currentMastered }
        })
      });

      if (!response.ok) throw new Error('Failed to update');

      // Update local state
      setWrongWords(prev =>
        prev.map(w => w.word === word ? { ...w, mastered: !currentMastered } : w)
      );
    } catch (error) {
      console.error('Error updating word:', error);
    } finally {
      setUpdatingWords(prev => {
        const next = new Set(prev);
        next.delete(word);
        return next;
      });
    }
  };

  // Filter words
  const filteredWords = wrongWords.filter(w => {
    if (filter === '복습필요') return !w.mastered;
    if (filter === '마스터') return w.mastered;
    return true;
  });

  // Sort by wrong count descending
  const sortedWords = [...filteredWords].sort((a, b) => b.wrongCount - a.wrongCount);

  // Calculate stats
  const totalCount = wrongWords.length;
  const masteredCount = wrongWords.filter(w => w.mastered).length;
  const today = new Date().toISOString().split('T')[0];
  const todayReviewCount = wrongWords.filter(w =>
    !w.mastered && w.nextReview <= today
  ).length;
  const avgWrongCount = wrongWords.length > 0
    ? (wrongWords.reduce((sum, w) => sum + w.wrongCount, 0) / wrongWords.length).toFixed(1)
    : '0';

  // Get badge color based on wrong count
  const getBadgeColor = (count: number) => {
    if (count >= 3) return 'from-red-600 to-red-500';
    if (count === 2) return 'from-yellow-600 to-yellow-500';
    return 'from-green-600 to-green-500';
  };

  // Check if review is due
  const isReviewDue = (nextReview: string) => {
    return nextReview <= today;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 p-6 pb-24">
        <div className="max-w-4xl mx-auto">
          {/* Header Skeleton */}
          <div className="mb-8">
            <div className="h-10 w-48 bg-gray-800 rounded animate-pulse mb-2"></div>
            <div className="h-6 w-64 bg-gray-800 rounded animate-pulse"></div>
          </div>

          {/* Tabs Skeleton */}
          <div className="flex gap-2 mb-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 w-24 bg-gray-800 rounded animate-pulse"></div>
            ))}
          </div>

          {/* Stats Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-gray-800 rounded-lg animate-pulse"></div>
            ))}
          </div>

          {/* Cards Skeleton */}
          {[1, 2, 3].map(i => (
            <div key={i} className="h-40 bg-gray-800 rounded-lg mb-4 animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6 pb-24">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            ❌ 오답 노트
          </h1>
          <p className="text-gray-400">
            총 {totalCount}개 단어 | 마스터 {masteredCount}개
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {(['전체', '복습필요', '마스터'] as FilterType[]).map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-6 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                filter === tab
                  ? 'bg-red-500 text-white shadow-lg'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Spaced Repetition Info */}
        <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-lg p-6 mb-6 border border-gray-600">
          <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
            <span>📚</span>
            간격 반복 학습 시스템
          </h3>
          <p className="text-gray-300 text-sm mb-3">
            틀린 횟수에 따라 자동 복습 일정이 정해집니다
          </p>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              <span className="text-gray-300">1회: 다음날</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
              <span className="text-gray-300">2회: 3일 후</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
              <span className="text-gray-300">3회 이상: 7일 후</span>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <p className="text-gray-400 text-sm mb-1">전체 오답 단어</p>
            <p className="text-3xl font-bold text-white">{totalCount}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <p className="text-gray-400 text-sm mb-1">오늘 복습할 단어</p>
            <p className="text-3xl font-bold text-red-500">{todayReviewCount}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <p className="text-gray-400 text-sm mb-1">평균 오답 횟수</p>
            <p className="text-3xl font-bold text-yellow-500">{avgWrongCount}</p>
          </div>
        </div>

        {/* Wrong Words List */}
        {sortedWords.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-12 text-center border border-gray-700">
            <p className="text-gray-400 text-lg">
              {filter === '전체'
                ? '아직 오답이 없습니다! 🎉'
                : filter === '복습필요'
                ? '복습할 단어가 없습니다!'
                : '마스터한 단어가 없습니다!'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedWords.map(word => (
              <div
                key={word.word}
                className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-gray-600 transition-all"
              >
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  {/* Word Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-2xl font-bold text-white">{word.word}</h3>
                      <span
                        className={`px-3 py-1 rounded-full text-white text-sm font-semibold bg-gradient-to-r ${getBadgeColor(
                          word.wrongCount
                        )}`}
                      >
                        {word.wrongCount}회
                      </span>
                      {word.mastered && (
                        <span className="px-3 py-1 rounded-full bg-green-600 text-white text-xs font-semibold">
                          마스터
                        </span>
                      )}
                    </div>
                    <p className="text-gray-300 mb-4">{word.meaning}</p>

                    <div className="flex flex-wrap gap-4 text-sm">
                      <div className="text-gray-400">
                        <span className="text-gray-500">마지막 오답:</span>{' '}
                        {new Date(word.lastWrong).toLocaleDateString('ko-KR')}
                      </div>
                      <div className={`${isReviewDue(word.nextReview) && !word.mastered ? 'text-red-400 font-semibold' : 'text-gray-400'}`}>
                        <span className="text-gray-500">다음 복습:</span>{' '}
                        {new Date(word.nextReview).toLocaleDateString('ko-KR')}
                        {isReviewDue(word.nextReview) && !word.mastered && ' 🔔'}
                      </div>
                    </div>
                  </div>

                  {/* Master Toggle Button */}
                  <button
                    onClick={() => toggleMastered(word.word, word.mastered)}
                    disabled={updatingWords.has(word.word)}
                    className={`px-6 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                      word.mastered
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        : 'bg-green-600 text-white hover:bg-green-500'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {updatingWords.has(word.word)
                      ? '처리중...'
                      : word.mastered
                      ? '마스터 취소'
                      : '마스터 완료'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
