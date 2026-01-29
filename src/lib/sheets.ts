// Google Sheets API integration for 옛설판다

import { google } from 'googleapis';
import type { Config, Word, WrongWord, Result, Attendance, Subscriber, ConfigRow } from './types';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID!;

// Initialize Google Sheets API
function getGoogleSheetsClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}');
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

// Config operations
export async function getConfig(): Promise<Config> {
  const sheets = getGoogleSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Config!A2:B',
  });

  const rows = response.data.values || [];
  const config: Config = {
    CurrentDay: '1',
    TotalDays: '1',
  };

  rows.forEach((row: string[]) => {
    const key = row[0];
    const value = row[1];
    if (key === 'CurrentDay') config.CurrentDay = value;
    if (key === 'TotalDays') config.TotalDays = value;
    if (key === 'SpreadsheetId') config.SpreadsheetId = value;
  });

  return config;
}

export async function updateConfig(key: string, value: string): Promise<void> {
  const sheets = getGoogleSheetsClient();
  
  // First, get all config rows to find the right one
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Config!A2:B',
  });

  const rows = response.data.values || [];
  let rowIndex = -1;

  rows.forEach((row: string[], index: number) => {
    if (row[0] === key) {
      rowIndex = index + 2; // +2 because A2 is the first data row
    }
  });

  if (rowIndex !== -1) {
    // Update existing row
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Config!B${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[value]],
      },
    });
  } else {
    // Append new row
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Config!A:B',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[key, value]],
      },
    });
  }
}

// Words operations
export async function getWords(day?: number): Promise<Word[]> {
  const sheets = getGoogleSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Words!A2:C',
  });

  const rows = response.data.values || [];
  const words: Word[] = rows.map((row: string[]) => ({
    Day: parseInt(row[0]),
    Word: row[1],
    Meaning: row[2],
  }));

  if (day !== undefined) {
    return words.filter((word) => word.Day === day);
  }

  return words;
}

export async function getAllWords(): Promise<Word[]> {
  return getWords();
}

// WrongWords operations
export async function getWrongWords(email?: string): Promise<WrongWord[]> {
  const sheets = getGoogleSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'WrongWords!A2:G',
  });

  const rows = response.data.values || [];
  const wrongWords: WrongWord[] = rows.map((row: string[]) => ({
    Email: row[0],
    Word: row[1],
    Meaning: row[2],
    WrongCount: parseInt(row[3] || '0'),
    LastWrong: row[4],
    NextReview: row[5],
    Mastered: row[6] === 'TRUE' || row[6] === 'true',
  }));

  if (email) {
    return wrongWords.filter((word) => word.Email === email);
  }

  return wrongWords;
}

export async function updateWrongWord(
  email: string,
  word: string,
  data: Partial<WrongWord>
): Promise<void> {
  const sheets = getGoogleSheetsClient();
  
  // Get all wrong words
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'WrongWords!A2:G',
  });

  const rows = response.data.values || [];
  let rowIndex = -1;

  rows.forEach((row: string[], index: number) => {
    if (row[0] === email && row[1] === word) {
      rowIndex = index + 2;
    }
  });

  const updatedRow = [
    email,
    word,
    data.Meaning || '',
    data.WrongCount?.toString() || '0',
    data.LastWrong || '',
    data.NextReview || '',
    data.Mastered ? 'TRUE' : 'FALSE',
  ];

  if (rowIndex !== -1) {
    // Update existing row
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `WrongWords!A${rowIndex}:G${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [updatedRow],
      },
    });
  } else {
    // Append new row
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'WrongWords!A:G',
      valueInputOption: 'RAW',
      requestBody: {
        values: [updatedRow],
      },
    });
  }
}

// Results operations
export async function getResults(email?: string, day?: number): Promise<Result[]> {
  const sheets = getGoogleSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Results!A2:H',
  });

  const rows = response.data.values || [];
  let results: Result[] = rows.map((row: string[]) => ({
    Email: row[0],
    Day: parseInt(row[1]),
    QuizType: row[2] as 'morning' | 'lunch',
    Word: row[3],
    CorrectAnswer: row[4],
    UserAnswer: row[5],
    IsCorrect: row[6] === 'TRUE' || row[6] === 'true',
    Timestamp: row[7],
  }));

  if (email) {
    results = results.filter((result) => result.Email === email);
  }

  if (day !== undefined) {
    results = results.filter((result) => result.Day === day);
  }

  return results;
}

// Attendance operations
export async function getAttendance(email?: string): Promise<Attendance[]> {
  const sheets = getGoogleSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Attendance!A2:D',
  });

  const rows = response.data.values || [];
  const attendance: Attendance[] = rows.map((row: string[]) => ({
    Email: row[0],
    Date: row[1],
    Type: row[2] as 'morning' | 'lunch' | 'evening',
    Completed: row[3] === 'TRUE' || row[3] === 'true',
  }));

  if (email) {
    return attendance.filter((att) => att.Email === email);
  }

  return attendance;
}

export async function addAttendance(
  email: string,
  date: string,
  type: 'morning' | 'lunch' | 'evening'
): Promise<void> {
  const sheets = getGoogleSheetsClient();
  
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Attendance!A:D',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[email, date, type, 'TRUE']],
    },
  });
}

// Subscribers operations
export async function getSubscribers(): Promise<Subscriber[]> {
  const sheets = getGoogleSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Subscribers!A2:C',
  });

  const rows = response.data.values || [];
  return rows.map((row: string[]) => ({
    Email: row[1],
    Name: row[0],
    Status: row[2] as 'active' | 'inactive',
  }));
}
