// Supabase database operations for 옛설판다 (replaces sheets.ts)

import { getServerClient } from './supabase';
import type {
  Config, Word, WrongWord, Result, Attendance, Subscriber, QuizResult, QuizAnswer,
} from './types';

type PagingOptions = { limit?: number; offset?: number };

const DEFAULT_PAGE_LIMITS = {
  WRONG_WORDS: 100,
  RESULTS: 100,
  ATTENDANCE: 90,
} as const;

const MAX_PAGE_LIMIT = 500;

function normalizeLimit(value: number | undefined, fallback: number): number {
  if (!Number.isInteger(value) || value <= 0) {
    return fallback;
  }

  return Math.min(value, MAX_PAGE_LIMIT);
}

function normalizeOffset(value: number | undefined): number {
  if (!Number.isInteger(value) || value < 0) {
    return 0;
  }
  return value;
}

function applyPaging(
  query: ReturnType<ReturnType<typeof getServerClient>['from']>,
  options: PagingOptions,
  defaultLimit: number,
): ReturnType<ReturnType<typeof getServerClient>['from']> {
  const limit = normalizeLimit(options.limit, defaultLimit);
  const offset = normalizeOffset(options.offset);
  return query.range(offset, offset + limit - 1);
}

// Config operations
export async function getConfig(): Promise<Config> {
  const supabase = getServerClient();
  const { data, error } = await supabase
    .from('config')
    .select('key, value');

  if (error) throw new Error(`Failed to fetch config: ${error.message}`);

  const config: Config = {
    CurrentDay: '1',
    TotalDays: '1',
    WordsPerDay: '10',
  };

  (data || []).forEach((row: { key: string; value: string }) => {
    if (row.key === 'CurrentDay') config.CurrentDay = row.value;
    if (row.key === 'TotalDays') config.TotalDays = row.value;
    if (row.key === 'WordsPerDay') config.WordsPerDay = row.value;
  });

  return config;
}

export async function updateConfig(key: string, value: string): Promise<void> {
  const supabase = getServerClient();
  const { error } = await supabase
    .from('config')
    .upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );

  if (error) throw new Error(`Failed to update config: ${error.message}`);
}

// Words operations
export async function getWords(day?: number): Promise<Word[]> {
  const supabase = getServerClient();
  let query = supabase.from('words').select('day, word, meaning');

  if (day !== undefined) {
    query = query.eq('day', day);
  }

  const { data, error } = await query.order('day').order('id');

  if (error) throw new Error(`Failed to fetch words: ${error.message}`);

  return (data || []).map((row: { day: number; word: string; meaning: string }) => ({
    Day: row.day,
    Word: row.word,
    Meaning: row.meaning,
  }));
}

export async function getAllWords(): Promise<Word[]> {
  return getWords();
}

// WrongWords operations
export async function getWrongWords(
  email?: string,
  options?: { limit?: number; offset?: number; mastered?: boolean }
): Promise<WrongWord[]> {
  const supabase = getServerClient();
  let query = supabase
    .from('wrong_words')
    .select('*')
    .order('last_wrong', { ascending: false });
  query = applyPaging(query, options ?? {}, DEFAULT_PAGE_LIMITS.WRONG_WORDS);

  if (email) {
    query = query.eq('email', email);
  }

  if (options?.mastered !== undefined) {
    query = query.eq('mastered', options.mastered);
  }

  const { data, error } = await query;

  if (error) throw new Error(`Failed to fetch wrong words: ${error.message}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data || []).map((row: any) => ({
    Email: row.email,
    Word: row.word,
    Meaning: row.meaning,
    WrongCount: row.wrong_count,
    LastWrong: row.last_wrong || '',
    NextReview: row.next_review || '',
    Mastered: row.mastered,
  }));
}

export async function updateWrongWord(
  email: string,
  word: string,
  data: Partial<WrongWord>
): Promise<void> {
  const supabase = getServerClient();
  const { error } = await supabase
    .from('wrong_words')
    .upsert(
      {
        email,
        word,
        meaning: data.Meaning || '',
        wrong_count: data.WrongCount || 0,
        last_wrong: data.LastWrong || null,
        next_review: data.NextReview || null,
        mastered: data.Mastered || false,
      },
      { onConflict: 'email,word' }
    );

  if (error) throw new Error(`Failed to update wrong word: ${error.message}`);
}

// Results operations
export async function getResults(
  email?: string,
  day?: number,
  options?: { limit?: number; offset?: number }
): Promise<Result[]> {
  const supabase = getServerClient();
  let query = supabase
    .from('results')
    .select('*')
    .order('timestamp', { ascending: false });
  query = applyPaging(query, options ?? {}, DEFAULT_PAGE_LIMITS.RESULTS);

  if (email) {
    query = query.eq('email', email);
  }
  if (day !== undefined) {
    query = query.eq('day', day);
  }

  const { data, error } = await query;

  if (error) throw new Error(`Failed to fetch results: ${error.message}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data || []).map((row: any) => ({
    Email: row.email,
    Day: row.day,
    QuizType: row.quiz_type,
    Word: row.word,
    CorrectAnswer: row.correct_answer,
    UserAnswer: row.user_answer,
    IsCorrect: row.is_correct,
    Timestamp: row.timestamp,
  }));
}

// Attendance operations
export async function getAttendance(
  email?: string,
  options?: { limit?: number; offset?: number; fromDate?: string; toDate?: string }
): Promise<Attendance[]> {
  const supabase = getServerClient();
  let query = supabase
    .from('attendance')
    .select('*')
    .order('date', { ascending: false });
  query = applyPaging(query, options ?? {}, DEFAULT_PAGE_LIMITS.ATTENDANCE);

  if (email) {
    query = query.eq('email', email);
  }

  if (options?.fromDate) {
    query = query.gte('date', options.fromDate);
  }

  if (options?.toDate) {
    query = query.lte('date', options.toDate);
  }

  const { data, error } = await query;

  if (error) throw new Error(`Failed to fetch attendance: ${error.message}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data || []).map((row: any) => ({
    Email: row.email,
    Date: row.date,
    Type: row.type,
    Completed: row.completed,
  }));
}

export async function addAttendance(
  email: string,
  date: string,
  type: 'morning' | 'lunch' | 'evening'
): Promise<void> {
  const supabase = getServerClient();
  const { error } = await supabase
    .from('attendance')
    .upsert(
      { email, date, type, completed: true },
      { onConflict: 'email,date,type' }
    );

  if (error) throw new Error(`Failed to add attendance: ${error.message}`);
}

// Subscribers operations
export async function getSubscribers(): Promise<Subscriber[]> {
  const supabase = getServerClient();
  const { data, error } = await supabase
    .from('subscribers')
    .select('email, name, status');

  if (error) throw new Error(`Failed to fetch subscribers: ${error.message}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data || []).map((row: any) => ({
    Email: row.email,
    Name: row.name,
    Status: row.status,
  }));
}

// Quiz Results operations
export async function getQuizResults(email?: string, day?: number): Promise<QuizResult[]> {
  const supabase = getServerClient();
  let query = supabase.from('quiz_results').select('*');

  if (email) {
    query = query.eq('email', email);
  }
  if (day !== undefined) {
    query = query.eq('day', day);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch quiz results: ${error.message}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data || []).map((row: any) => ({
    Email: row.email,
    Day: row.day,
    QuizType: row.quiz_type,
    Score: row.score,
    Total: row.total,
    Answers: row.answers,
    CreatedAt: row.created_at,
  }));
}

export async function saveQuizResult(
  email: string,
  day: number,
  quizType: 'morning' | 'lunch' | 'evening',
  score: number,
  total: number,
  answers: QuizAnswer[]
): Promise<void> {
  const supabase = getServerClient();
  const { error } = await supabase.from('quiz_results').insert({
    email,
    day,
    quiz_type: quizType,
    score,
    total,
    answers,
    created_at: new Date().toISOString(),
  });

  if (error) throw new Error(`Failed to save quiz result: ${error.message}`);
}
