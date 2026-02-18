import { NextRequest, NextResponse } from 'next/server';
import { sanitizeDay, sanitizeEmail } from '@/lib/auth-middleware';

type ValidationDetails = Record<string, unknown> | string | string[] | ValidationIssue[] | undefined;

export type ApiErrorCode =
  | 'INVALID_INPUT'
  | 'INVALID_REQUEST_FORMAT'
  | 'FORBIDDEN'
  | 'UNAUTHORIZED'
  | 'CONFIG_MISSING'
  | 'DEPENDENCY_ERROR'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR';

export interface ApiErrorPayload {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: ValidationDetails;
  };
}

export interface ValidationIssue {
  field: string;
  code: string;
  message: string;
}

export type ParseResult<T> =
  | { success: true; value: T }
  | { success: false; code: string; message: string; details?: ValidationDetails };

interface FieldParser<T> {
  required: boolean;
  parse: (value: unknown) => ParseResult<T>;
}

type Schema<T> = {
  [K in keyof T]: FieldParser<T[K]>;
};

const ERROR_STATUS: Record<ApiErrorCode, number> = {
  INVALID_INPUT: 400,
  INVALID_REQUEST_FORMAT: 400,
  FORBIDDEN: 403,
  UNAUTHORIZED: 401,
  CONFIG_MISSING: 503,
  DEPENDENCY_ERROR: 500,
  RATE_LIMITED: 429,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
};

const DEFAULT_MAX_REQUEST_BYTES = 256 * 1024;
const MAX_QUIZ_ANSWERS = 200;

export function apiError(
  code: ApiErrorCode,
  message: string,
  details?: ValidationDetails,
  status?: number,
): NextResponse {
  const payload: ApiErrorPayload = {
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  };

  return NextResponse.json(payload, { status: status ?? ERROR_STATUS[code] ?? 500 });
}

export function validationError(issues: ValidationIssue[]): NextResponse {
  return apiError('INVALID_INPUT', 'Request validation failed', issues);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

export async function parseJsonRequest<T>(
  request: NextRequest,
  schema: Schema<T>,
  options?: {
    maxBodyBytes?: number;
  },
): Promise<ParseResult<T>> {
  const maxBodyBytes = options?.maxBodyBytes ?? DEFAULT_MAX_REQUEST_BYTES;

  const contentLength = request.headers.get('content-length');
  if (contentLength) {
    const declaredBytes = Number(contentLength);
    if (Number.isFinite(declaredBytes) && declaredBytes > maxBodyBytes) {
      return {
        success: false,
        code: 'INVALID_REQUEST_FORMAT',
        message: `Request payload too large. Max ${maxBodyBytes} bytes.`,
      };
    }
  }

  let rawText: string;
  let raw: unknown;

  try {
    rawText = await request.text();
  } catch {
    return { success: false, code: 'INVALID_REQUEST_FORMAT', message: 'Invalid JSON body' };
  }

  if (rawText.length > 0) {
    const actualBytes = new TextEncoder().encode(rawText).length;
    if (actualBytes > maxBodyBytes) {
      return {
        success: false,
        code: 'INVALID_REQUEST_FORMAT',
        message: `Request payload too large. Max ${maxBodyBytes} bytes.`,
      };
    }
  }

  try {
    raw = JSON.parse(rawText);
  } catch {
    return { success: false, code: 'INVALID_REQUEST_FORMAT', message: 'Invalid JSON body' };
  }

  if (!isPlainObject(raw)) {
    return {
      success: false,
      code: 'INVALID_REQUEST_FORMAT',
      message: 'Request body must be a JSON object',
    };
  }

  const body = raw as Record<string, unknown>;
  const normalized = {} as T;
  const issues: ValidationIssue[] = [];

  const schemaEntries = Object.entries(schema) as Array<[
    keyof T,
    FieldParser<T[keyof T]> | undefined
  ]>;

  for (const [field, definition] of schemaEntries) {
    const hasField = Object.prototype.hasOwnProperty.call(body, field as string);
    if (!hasField || body[field as string] === undefined) {
      if (definition?.required) {
        issues.push({
          field: String(field),
          code: 'REQUIRED_FIELD_MISSING',
          message: `Missing required field: ${String(field)}`,
        });
      }
      continue;
    }

    const parsed = definition?.parse(body[field as string]);
    if (!parsed || !parsed.success) {
      issues.push({
        field: String(field),
        code: parsed?.code || 'INVALID_FIELD',
        message:
          parsed?.message || `Invalid value for field: ${String(field)}`,
      });
      continue;
    }

    normalized[field] = parsed.value;
  }

  if (issues.length > 0) {
    return {
      success: false,
      code: 'INVALID_INPUT',
      message: 'Request validation failed',
      details: issues,
    };
  }

  return { success: true, value: normalized };
}

export function parseText(
  value: unknown,
  options: { maxLength?: number; allowEmpty?: boolean } = {},
): ParseResult<string> {
  if (typeof value !== 'string') {
    return fail('INVALID_TEXT', 'Must be a string');
  }

  const trimmed = value.trim();
  const maxLength = options.maxLength ?? 500;

  if (!options.allowEmpty && trimmed.length === 0) {
    return fail('INVALID_TEXT', 'Text must not be empty');
  }

  if (trimmed.length > maxLength) {
    return fail('INVALID_TEXT', `Text exceeds max length of ${maxLength}`);
  }

  return { success: true, value: trimmed };
}

export function parseConfigKey(value: unknown): ParseResult<string> {
  if (typeof value !== 'string') {
    return fail('INVALID_CONFIG_KEY', 'Config key must be a string');
  }

  const normalized = value.trim();
  if (!/^[A-Za-z][A-Za-z0-9_]{0,48}$/.test(normalized)) {
    return fail(
      'INVALID_CONFIG_KEY',
      'Config key must start with a letter and contain only letters, numbers, or underscores',
    );
  }

  return { success: true, value: normalized };
}

export function parseJsonObject(value: unknown): ParseResult<Record<string, unknown>> {
  if (!isPlainObject(value)) {
    return fail('INVALID_OBJECT', 'Value must be a JSON object');
  }

  return { success: true, value: value as Record<string, unknown> };
}

export function parseFailureToResponse(
  result: ParseResult<unknown>,
): NextResponse {
  if (result.success) {
    return apiError('INTERNAL_ERROR', 'Parsing was successful');
  }

  if (Array.isArray(result.details) && result.details.length > 0 && typeof result.details[0] === 'object' && 'field' in result.details[0]) {
    return validationError(result.details as ValidationIssue[]);
  }

  return apiError(
    result.code === 'INVALID_REQUEST_FORMAT'
      ? 'INVALID_REQUEST_FORMAT'
      : 'INVALID_INPUT',
    result.message,
    result.details,
  );
}

function fail(code: string, message: string): ParseResult<never> {
  return { success: false, code, message };
}

export function parseEmail(value: unknown): ParseResult<string> {
  if (typeof value !== 'string') {
    return fail('INVALID_EMAIL', 'Email must be a string');
  }

  const parsed = sanitizeEmail(value);
  if (!parsed) {
    return fail('INVALID_EMAIL', 'Invalid email format');
  }

  return { success: true, value: parsed };
}

export function parseOptionalText(value: unknown, options: { maxLength?: number; allowEmpty?: boolean } = {}): ParseResult<string> {
  if (typeof value !== 'string') {
    return fail('INVALID_TEXT', 'Must be a string');
  }

  const trimmed = value.trim();
  const maxLength = options.maxLength ?? 500;

  if (!options.allowEmpty && trimmed.length === 0) {
    return fail('INVALID_TEXT', 'Text must not be empty');
  }

  if (trimmed.length > maxLength) {
    return fail('INVALID_TEXT', `Text exceeds max length of ${maxLength}`);
  }

  return { success: true, value: trimmed };
}

export function parseOptionalBoolean(value: unknown): ParseResult<boolean> {
  if (typeof value !== 'boolean') {
    return fail('INVALID_BOOLEAN', 'Must be true or false');
  }
  return { success: true, value: value };
}

export function parseIntRange(
  value: unknown,
  options: { min: number; max: number },
): ParseResult<number> {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return fail('INVALID_INTEGER', 'Must be an integer');
  }

  if (value < options.min || value > options.max) {
    return fail(
      'INVALID_INTEGER',
      `Value must be between ${options.min} and ${options.max}`,
    );
  }

  return { success: true, value };
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function parseHHmm(value: unknown): ParseResult<string> {
  if (typeof value !== 'string') {
    return fail('INVALID_TIME', 'Time must be in HH:mm format');
  }

  const normalized = value.trim();
  if (!TIME_RE.test(normalized)) {
    return fail('INVALID_TIME', 'Time must be in HH:mm format');
  }

  return { success: true, value: normalized };
}

function buildTimezoneWhitelist(): Set<string> {
  const fallback = [
    'UTC',
    'Asia/Seoul',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'America/New_York',
    'America/Los_Angeles',
    'Europe/London',
  ];

  const configured = (process.env.ALLOWED_TIMEZONES || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const allowed = configured.length > 0 ? configured : fallback;
  return new Set(allowed);
}

const TIMEZONE_WHITELIST = buildTimezoneWhitelist();

export function parseTimezone(value: unknown): ParseResult<string> {
  if (typeof value !== 'string') {
    return fail('INVALID_TIMEZONE', 'Timezone must be a string');
  }

  const normalized = value.trim();
  if (!TIMEZONE_WHITELIST.has(normalized)) {
    return fail('INVALID_TIMEZONE', 'Timezone is not allowed');
  }

  return { success: true, value: normalized };
}

export function parseDay(value: unknown): ParseResult<number> {
  const day = sanitizeDay(typeof value === 'number' || typeof value === 'string' ? value : null);
  if (!day) {
    return fail('INVALID_DAY', 'Invalid day value');
  }
  return { success: true, value: day };
}

export function parseActiveDays(raw: unknown): ParseResult<number[]> {
  if (!Array.isArray(raw)) {
    return fail('INVALID_ACTIVE_DAYS', 'active_days must be an array');
  }

  const values = new Set<number>();

  for (const item of raw) {
    const parsed = typeof item === 'number'
      ? item
      : typeof item === 'string'
        ? Number(item.trim())
        : NaN;

    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 7) {
      return fail('INVALID_ACTIVE_DAYS', 'active_days must contain only integers 1..7');
    }

    values.add(parsed);
  }

  return { success: true, value: [...values].sort((a, b) => a - b) };
}

export function parsePhone(raw: unknown): ParseResult<string> {
  if (typeof raw !== 'string') {
    return fail('INVALID_PHONE', 'Phone must be a string');
  }

  const digits = raw.replace(/[^\d]/g, '');
  if (digits === '') {
    return { success: true, value: '' };
  }

  if (digits.length < 10 || digits.length > 11) {
    return fail('INVALID_PHONE', 'Phone number must be 10 or 11 digits');
  }

  return { success: true, value: digits };
}

const ATTENDANCE_TYPES = ['morning', 'lunch', 'evening'] as const;

type AttendanceType = (typeof ATTENDANCE_TYPES)[number];

export function parseAttendanceType(value: unknown): ParseResult<AttendanceType> {
  if (typeof value !== 'string') {
    return fail('INVALID_ATTENDANCE_TYPE', 'Attendance type must be a string');
  }

  const normalized = value.trim().toLowerCase();
  if (!ATTENDANCE_TYPES.includes(normalized as AttendanceType)) {
    return fail(
      'INVALID_ATTENDANCE_TYPE',
      `Attendance type must be one of: ${ATTENDANCE_TYPES.join(', ')}`,
    );
  }

  return { success: true, value: normalized as AttendanceType };
}

type QuizAnswer = {
  word: string;
  meaning: string;
  memorized: boolean;
};

export function parseQuizAnswer(value: unknown): ParseResult<QuizAnswer> {
  if (!isPlainObject(value)) {
    return fail('INVALID_QUIZ_ANSWER', 'Each quiz result must be an object');
  }

  const candidate = value as { word?: unknown; meaning?: unknown; memorized?: unknown };
  const parsedWord = parseOptionalText(candidate.word, { maxLength: 200 });
  if (!parsedWord.success) return parsedWord;

  const parsedMeaning = parseOptionalText(candidate.meaning, { maxLength: 500 });
  if (!parsedMeaning.success) return parsedMeaning;

  const parsedMemorized = parseOptionalBoolean(candidate.memorized);
  if (!parsedMemorized.success) return parsedMemorized;

  return {
    success: true,
    value: {
      word: parsedWord.value,
      meaning: parsedMeaning.value,
      memorized: parsedMemorized.value,
    },
  };
}

export function parseQuizAnswers(raw: unknown): ParseResult<QuizAnswer[]> {
  if (!Array.isArray(raw)) {
    return fail('INVALID_QUIZ_RESULTS', 'results must be an array');
  }

  if (raw.length === 0) {
    return fail('INVALID_QUIZ_RESULTS', 'results must contain at least 1 item');
  }

  if (raw.length > MAX_QUIZ_ANSWERS) {
    return fail('INVALID_QUIZ_RESULTS', `results must contain at most ${MAX_QUIZ_ANSWERS} items`);
  }

  const normalized: QuizAnswer[] = [];
  for (const item of raw) {
    const parsed = parseQuizAnswer(item);
    if (!parsed.success) {
      return { ...parsed, code: `INVALID_QUIZ_RESULTS` };
    }

    normalized.push(parsed.value);
  }

  return { success: true, value: normalized };
}

export function parseQuizType(raw: unknown): ParseResult<string> {
  if (raw === undefined || raw === null) {
    return { success: true, value: 'lunch' };
  }

  if (typeof raw !== 'string') {
    return fail('INVALID_QUIZ_TYPE', 'quiz_type must be a string');
  }

  const normalized = raw.trim().toLowerCase();
  if (!['morning', 'lunch', 'evening'].includes(normalized)) {
    return fail('INVALID_QUIZ_TYPE', 'quiz_type must be morning, lunch, or evening');
  }

  return { success: true, value: normalized };
}

export function parseStatus(raw: unknown): ParseResult<'active' | 'paused'> {
  if (typeof raw !== 'string') {
    return fail('INVALID_STATUS', 'status must be a string');
  }

  const normalized = raw.trim().toLowerCase();
  if (!['active', 'paused'].includes(normalized)) {
    return fail('INVALID_STATUS', 'status must be active or paused');
  }

  return { success: true, value: normalized as 'active' | 'paused' };
}

export { TIME_RE as HHMM_TIME_RE };
export { TIMEZONE_WHITELIST };
