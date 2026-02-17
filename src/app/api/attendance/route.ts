import { NextRequest, NextResponse } from 'next/server';
import { getAttendance, addAttendance } from '@/lib/db';
import {
  apiError,
  parseFailureToResponse,
  parseJsonRequest,
  parseEmail,
  parseAttendanceType,
  parseIntRange,
} from '@/lib/api-contract';
import { requireAuth, verifyEmailOwnership } from '@/lib/auth-middleware';
import { sanitizeEmail } from '@/lib/auth-middleware';
import { checkRateLimit, responseRateLimited } from '@/lib/request-policy';

type AttendanceBody = {
  email?: string;
  date: string;
  type: 'morning' | 'lunch' | 'evening';
};

export async function GET(request: NextRequest) {
  const rate = checkRateLimit('api:attendance:get', request, {
    maxRequests: 120,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return responseRateLimited(rate.retryAfter || 1, 'api:attendance:get');
  }

  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return apiError('UNAUTHORIZED', 'Authentication required');
    const { user } = authResult;

    const requestedEmail = sanitizeEmail(request.nextUrl.searchParams.get('email')) || user.email;
    if (!requestedEmail) {
      return apiError('INVALID_INPUT', 'Missing email');
    }

    const searchParams = request.nextUrl.searchParams;
    const parsedLimit = parseIntRange(Number(searchParams.get('limit')), {
      min: 1,
      max: 500,
    });
    if (searchParams.has('limit') && !parsedLimit.success) {
      return parseFailureToResponse(parsedLimit);
    }

    const parsedOffset = parseIntRange(Number(searchParams.get('offset')), {
      min: 0,
      max: 10000,
    });
    if (searchParams.has('offset') && !parsedOffset.success) {
      return parseFailureToResponse(parsedOffset);
    }

    const parseDateParam = (raw: string | null): string | null => {
      if (raw === null) return null;

      const trimmed = raw.trim();
      const parsedDate = new Date(trimmed);
      const [year, month, day] = trimmed.split('-').map((part) => Number(part));
      const isValidDate =
        /^\d{4}-\d{2}-\d{2}$/.test(trimmed) &&
        Number.isInteger(year) &&
        Number.isInteger(month) &&
        Number.isInteger(day) &&
        !Number.isNaN(parsedDate.getTime()) &&
        parsedDate.getUTCFullYear() === year &&
        parsedDate.getUTCMonth() + 1 === month &&
        parsedDate.getUTCDate() === day;

      return isValidDate ? trimmed : null;
    };

    const fromDate = parseDateParam(searchParams.get('fromDate'));
    if (searchParams.has('fromDate') && fromDate === null) {
      return apiError('INVALID_INPUT', 'fromDate must be YYYY-MM-DD');
    }

    const toDate = parseDateParam(searchParams.get('toDate'));
    if (searchParams.has('toDate') && toDate === null) {
      return apiError('INVALID_INPUT', 'toDate must be YYYY-MM-DD');
    }

    if (!verifyEmailOwnership(user.email, requestedEmail)) {
      return apiError('FORBIDDEN', 'Forbidden');
    }

    const attendance = await getAttendance(requestedEmail, {
      limit: parsedLimit.success ? parsedLimit.value : undefined,
      offset: parsedOffset.success ? parsedOffset.value : undefined,
      ...(fromDate ? { fromDate } : {}),
      ...(toDate ? { toDate } : {}),
    });
    return NextResponse.json(attendance);
  } catch (error) {
    console.error('Error fetching attendance:', error);
    return apiError('DEPENDENCY_ERROR', 'Failed to fetch attendance');
  }
}

export async function POST(request: NextRequest) {
  try {
    const rate = checkRateLimit('api:attendance:post', request, {
      maxRequests: 90,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return responseRateLimited(rate.retryAfter || 1, 'api:attendance:post');
    }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return apiError('UNAUTHORIZED', 'Authentication required');
    const { user } = authResult;

    const parsed = await parseJsonRequest<AttendanceBody>(request, {
      email: { required: false, parse: parseEmail },
      date: {
        required: true,
        parse: (value) => {
          if (typeof value !== 'string') {
            return { success: false, code: 'INVALID_DATE', message: 'date must be YYYY-MM-DD' };
          }

          const parsedDate = value.trim();
          const normalized = new Date(parsedDate);
          const [year, month, day] = parsedDate.split('-').map((part) => Number(part));
          const isValidDate =
            /^\d{4}-\d{2}-\d{2}$/.test(parsedDate) &&
            Number.isInteger(year) &&
            Number.isInteger(month) &&
            Number.isInteger(day) &&
            !Number.isNaN(normalized.getTime()) &&
            normalized.getUTCFullYear() === year &&
            normalized.getUTCMonth() + 1 === month &&
            normalized.getUTCDate() === day;

          if (!isValidDate) {
            return { success: false, code: 'INVALID_DATE', message: 'date must be YYYY-MM-DD' };
          }

          return { success: true, value: parsedDate };
        },
      },
      type: { required: true, parse: parseAttendanceType },
    });

    if (!parsed.success) {
      return parseFailureToResponse(parsed);
    }

    const targetEmail = parsed.value.email || user.email;
    if (!verifyEmailOwnership(user.email, targetEmail)) {
      return apiError('FORBIDDEN', 'Forbidden');
    }

    const bodyDate = parsed.value.date;
    await addAttendance(targetEmail, bodyDate, parsed.value.type);
    return NextResponse.json({ success: true, email: targetEmail, date: bodyDate, type: parsed.value.type });
  } catch (error) {
    console.error('Error adding attendance:', error);
    return apiError('DEPENDENCY_ERROR', 'Failed to add attendance');
  }
}

