// Type definitions for 옛설판다 dashboard

export interface Config {
  CurrentDay: string;
  TotalDays: string;
  WordsPerDay?: string;
}

export interface Word {
  Day: number;
  Word: string;
  Meaning: string;
}

export interface Subscriber {
  Email: string;
  Name: string;
  Status: 'active' | 'inactive';
}

export interface WrongWord {
  Email: string;
  Word: string;
  Meaning: string;
  WrongCount: number;
  LastWrong: string;
  NextReview: string;
  Mastered: boolean;
}

export interface Result {
  Email: string;
  Day: number;
  QuizType: 'morning' | 'lunch';
  Word: string;
  CorrectAnswer: string;
  UserAnswer: string;
  IsCorrect: boolean;
  Timestamp: string;
}

export interface Attendance {
  Email: string;
  Date: string;
  Type: 'morning' | 'lunch' | 'evening';
  Completed: boolean;
}

export interface ConfigRow {
  Key: string;
  Value: string;
}

// Supabase DB row types (snake_case)
export interface DbConfig {
  id: number;
  key: string;
  value: string;
  updated_at: string;
}

export interface DbWord {
  id: number;
  day: number;
  word: string;
  meaning: string;
}

export interface DbSubscriber {
  id: number;
  email: string;
  name: string;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface DbWrongWord {
  id: number;
  email: string;
  word: string;
  meaning: string;
  wrong_count: number;
  last_wrong: string | null;
  next_review: string | null;
  mastered: boolean;
}

export interface DbResult {
  id: number;
  email: string;
  day: number;
  quiz_type: 'morning' | 'lunch';
  word: string;
  correct_answer: string;
  user_answer: string;
  is_correct: boolean;
  timestamp: string;
}

export interface DbAttendance {
  id: number;
  email: string;
  date: string;
  type: 'morning' | 'lunch' | 'evening';
  completed: boolean;
}

// Quiz Results types
export interface QuizAnswer {
  word: string;
  meaning: string;
  memorized: boolean;
}

export interface QuizResult {
  Email: string;
  Day: number;
  QuizType: 'morning' | 'lunch' | 'evening';
  Score: number;
  Total: number;
  Answers: QuizAnswer[];
  CreatedAt: string;
}

export interface DbQuizResult {
  id: number;
  email: string;
  day: number;
  quiz_type: 'morning' | 'lunch' | 'evening';
  score: number;
  total: number;
  answers: QuizAnswer[];
  created_at: string;
}
