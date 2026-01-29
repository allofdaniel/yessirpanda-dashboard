"use client";

import { useState, useEffect } from "react";
import { Word } from "@/lib/types";

interface Config {
  CurrentDay: string;
  TotalDays: string;
}

export default function WordsPage() {
  const [allWords, setAllWords] = useState<Word[]>([]);
  const [filteredWords, setFilteredWords] = useState<Word[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedWordIndex, setExpandedWordIndex] = useState<number | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [wordsRes, configRes] = await Promise.all([
          fetch("/api/words"),
          fetch("/api/config"),
        ]);

        if (wordsRes.ok) {
          const words = await wordsRes.json();
          setAllWords(words);
        }

        if (configRes.ok) {
          const configData = await configRes.json();
          setConfig(configData);
          // Set default to current day
          const currentDay = parseInt(configData.CurrentDay);
          setSelectedDay(currentDay);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filter words based on selected day and search query
  useEffect(() => {
    let filtered = allWords;

    // Filter by day
    if (selectedDay !== null) {
      filtered = filtered.filter((word) => word.Day === selectedDay);
    }

    // Filter by search query
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

  const totalDays = config ? parseInt(config.TotalDays) : 0;
  const currentDay = config ? parseInt(config.CurrentDay) : 1;

  const handleDayClick = (day: number | null) => {
    setSelectedDay(day);
    setExpandedWordIndex(null); // Collapse any expanded word
  };

  const handleWordClick = (index: number) => {
    setExpandedWordIndex(expandedWordIndex === index ? null : index);
  };

  if (loading) {
    return (
      <div className="space-y-6">
          {/* Header Skeleton */}
          <div className="mb-8">
            <div className="h-10 w-48 bg-gray-800 rounded-lg animate-pulse mb-2"></div>
            <div className="h-6 w-32 bg-gray-800 rounded-lg animate-pulse"></div>
          </div>

          {/* Day Filter Skeleton */}
          <div className="mb-6">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="h-10 w-24 bg-gray-800 rounded-full animate-pulse flex-shrink-0"
                ></div>
              ))}
            </div>
          </div>

          {/* Search Bar Skeleton */}
          <div className="mb-6">
            <div className="h-12 w-full bg-gray-800 rounded-xl animate-pulse"></div>
          </div>

          {/* Words List Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-32 bg-gray-800 rounded-xl animate-pulse"
              ></div>
            ))}
          </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
            <span className="text-4xl">📚</span>
            단어장
          </h1>
          <p className="text-gray-400 text-lg">
            총 {filteredWords.length}개의 단어
          </p>
        </div>

        {/* Day Filter */}
        <div className="mb-6">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-purple-500 scrollbar-track-gray-800">
            {/* All Days Button */}
            <button
              onClick={() => handleDayClick(null)}
              className={`px-6 py-2 rounded-full font-medium transition-all duration-200 flex-shrink-0 ${
                selectedDay === null
                  ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/50"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
              }`}
            >
              전체
            </button>

            {/* Individual Day Buttons */}
            {[...Array(totalDays)].map((_, index) => {
              const day = index + 1;
              const isCurrentDay = day === currentDay;
              const isSelected = day === selectedDay;

              return (
                <button
                  key={day}
                  onClick={() => handleDayClick(day)}
                  className={`px-6 py-2 rounded-full font-medium transition-all duration-200 flex-shrink-0 relative ${
                    isSelected
                      ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/50"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
                  }`}
                >
                  Day {day}
                  {isCurrentDay && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-900"></span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <svg
              className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="단어 또는 뜻을 검색하세요..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-800 text-white rounded-xl border border-gray-700 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all duration-200"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Words List */}
        {filteredWords.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold text-gray-400 mb-2">
              검색 결과가 없습니다
            </h3>
            <p className="text-gray-500">
              다른 검색어를 시도하거나 필터를 변경해보세요
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredWords.map((word, index) => {
              const isExpanded = expandedWordIndex === index;
              const globalIndex =
                allWords.findIndex((w) => w === word) + 1 || index + 1;

              return (
                <div
                  key={`${word.Day}-${word.Word}-${index}`}
                  onClick={() => handleWordClick(index)}
                  className={`bg-gray-800 rounded-xl p-6 transition-all duration-200 cursor-pointer border-2 ${
                    isExpanded
                      ? "border-purple-500 shadow-lg shadow-purple-500/30"
                      : "border-transparent hover:border-gray-700"
                  } hover:bg-gray-800/80`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold text-[#FF6B35]">
                        {globalIndex}
                      </span>
                      <span className="px-3 py-1 bg-gradient-to-r from-purple-600/30 to-pink-600/30 border border-purple-500/50 rounded-full text-xs font-medium text-purple-300">
                        Day {word.Day}
                      </span>
                    </div>
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>

                  <div className="mb-2">
                    <h3 className="text-2xl font-bold text-white">
                      {word.Word}
                    </h3>
                  </div>

                  <p className="text-gray-400 text-base">{word.Meaning}</p>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-gray-700">
                      <div className="text-sm text-gray-500">
                        <p className="flex items-center gap-2">
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
                              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          Day {word.Day}의 단어입니다
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
}
