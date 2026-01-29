// Type definitions for 옛설판다 dashboard

export interface Config {
  CurrentDay: string;
  TotalDays: string;
  SpreadsheetId?: string;
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
