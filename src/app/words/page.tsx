'use client';

import { useEffect, useState } from 'react';


interface Word {
  Day: number;
  Word: string;
  Meaning: string;
}

export default function WordsPage() {
  const [allWords, setAllWords] = useState<Word[]>([]);
  const [filteredWords, setFilteredWords] = useState<Word[]>([]);
  const [config, setConfig] = useState<{ CurrentDay: string; TotalDays: string } | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedWordIndex, setExpandedWordIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [wordsRes, configRes] = await Promise.all([
          fetch('/api/words'),
          fetch('/api/config'),
        ]);

        const wordsData = await wordsRes.json();
        const configData = await configRes.json();

        setAllWords(wordsData);
        setConfig(configData);
        setSelectedDay(parseInt(configData.CurrentDay));
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    let filtered = allWords;

    if (selectedDay !== null) {
      filtered = filtered.filter((word) => word.Day === selectedDay);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (word) =>
          word.Word.toLowerCase().includes(query) ||
          word.Meaning.toLowerCase().includes(query)
      );
    }

    setFilteredWords(filtered);
  }, [allWords, selectedDay, searchQuery]);

  const handleDayFilter = (day: number | null) => {
    setSelectedDay(day);
    setExpandedWordIndex(null);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  const toggleWordExpand = (index: number) => {
    setExpandedWordIndex(expandedWordIndex === index ? null : index);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2 animate-fade-in">
          <div className="h-10 w-48 bg-zinc-900 animate-pulse rounded-xl" />
          <div className="h-6 w-64 bg-zinc-900 animate-pulse rounded-xl" />
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar animate-fade-in stagger-1">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-10 w-24 bg-zinc-900 animate-pulse rounded-xl flex-shrink-0" />
          ))}
        </div>

        <div className="animate-fade-in stagger-2">
          <div className="h-12 w-full bg-zinc-900 animate-pulse rounded-xl" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in stagger-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-40 bg-zinc-900 animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 animate-fade-in">
        <h1 className="text-3xl font-bold text-zinc-100">
          📚 단어장
        </h1>
        <p className="text-zinc-400">
          {selectedDay === null ? `전체 ${filteredWords.length}개의 단어` : `Day ${selectedDay} - ${filteredWords.length}개의 단어`}
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar animate-fade-in stagger-1">
        <button onClick={() => handleDayFilter(null)} className={`px-4 py-2 rounded-xl font-medium text-sm transition-all flex-shrink-0 ${selectedDay === null ? 'bg-violet-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}>
          전체
        </button>
        {config && [...Array(parseInt(config.TotalDays))].map((_, i) => {
          const day = i + 1;
          const isCurrentDay = day === parseInt(config.CurrentDay);
          return (
            <button key={day} onClick={() => handleDayFilter(day)} className={`relative px-4 py-2 rounded-xl font-medium text-sm transition-all flex-shrink-0 ${selectedDay === day ? 'bg-violet-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}>
              {isCurrentDay && <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full" />}
              Day {day}
            </button>
          );
        })}
      </div>

      <div className="relative animate-fade-in stagger-2">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="단어, 뜻, 예문 검색..." className="w-full bg-zinc-900/80 border border-white/[0.06] rounded-xl pl-11 pr-4 py-3 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50" />
        {searchQuery && (
          <button onClick={handleClearSearch} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      {filteredWords.length === 0 ? (
        <div className="card p-12 text-center animate-fade-in stagger-3">
          <div className="text-5xl mb-4">🔍</div>
          <p className="text-zinc-400 text-lg">검색 결과가 없습니다</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in stagger-3">
          {filteredWords.map((word, index) => {
            const isExpanded = expandedWordIndex === index;
            return (
              <div key={index} onClick={() => toggleWordExpand(index)} className="card p-5 cursor-pointer hover:border-violet-500/30 transition-all">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-violet-400 font-mono text-sm font-medium">#{index + 1}</span>
                  <span className="bg-violet-500/10 text-violet-400 text-xs px-2.5 py-0.5 rounded-full font-medium">Day {word.Day}</span>
                </div>
                <h3 className="text-xl font-bold text-zinc-100 mb-2">{word.Word}</h3>
                <p className="text-zinc-400">{word.Meaning}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
