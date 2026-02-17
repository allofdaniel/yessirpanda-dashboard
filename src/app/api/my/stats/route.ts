import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase';
import { requireAuth, verifyEmailOwnership, sanitizeEmail } from '@/lib/auth-middleware';
import { apiError } from '@/lib/api-contract';
import { checkRateLimit, responseRateLimited } from '@/lib/request-policy';

// GET /api/my/stats - Get user's study statistics
export async function GET(request: NextRequest) {
  try {
    const rate = checkRateLimit('api:my:stats', request, {
      maxRequests: 120,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return responseRateLimited(rate.retryAfter || 1, 'api:my:stats');
    }

    // Require authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return apiError('UNAUTHORIZED', 'Authentication required');
    const { user } = authResult;

    const emailParam = request.nextUrl.searchParams.get('email');
    const email = sanitizeEmail(emailParam);

    if (!email) return apiError('INVALID_INPUT', 'Valid email required');

    // Verify user can only access their own stats
    if (!verifyEmailOwnership(user.email, email)) {
      return apiError('FORBIDDEN', 'You can only access your own statistics');
    }

    const supabase = getServerClient();

    // Get all stats in parallel
    const [wrongRes, masteredRes, attendanceRes, configRes] = await Promise.all([
      supabase.from('wrong_words').select('word, meaning, wrong_count, last_wrong, mastered').eq('email', email),
      supabase.from('wrong_words').select('id', { count: 'exact' }).eq('email', email).eq('mastered', true),
      supabase
        .from('attendance')
        .select('date, type, completed')
        .eq('email', email)
        .order('date', { ascending: false }),
      supabase.from('config').select('key, value'),
    ]);

    const wrongWords = wrongRes.data || [];
    const masteredCount = masteredRes.count || 0;
    const attendance = attendanceRes.data || [];
    const config: Record<string, string> = {};
    configRes.data?.forEach((r: { key: string; value: string }) => {
      config[r.key] = r.value;
    });

    // Calculate streak
    let streak = 0;
    const today = new Date().toISOString().slice(0, 10);
    const dates = [...new Set(attendance.filter((a) => a.completed).map((a) => a.date))].sort().reverse();

    const checkDate = new Date(today);
    for (const d of dates) {
      const dateStr = checkDate.toISOString().slice(0, 10);
      if (d === dateStr) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (d < dateStr) {
        break;
      }
    }

    // Today's schedule
    const todayAttendance = attendance.filter((a) => a.date === today);
    const schedule = {
      morning: todayAttendance.some((a) => a.type === 'morning' && a.completed),
      lunch: todayAttendance.some((a) => a.type === 'lunch' && a.completed),
      evening: todayAttendance.some((a) => a.type === 'evening' && a.completed),
    };

    // Recent wrong words (top 5, not mastered, sorted by wrong_count desc)
    const recentWrong = wrongWords
      .filter((w) => !w.mastered)
      .sort((a, b) => b.wrong_count - a.wrong_count)
      .slice(0, 5);

    // Average words mastered per day (total mastered / total days studied)
    const uniqueDays = new Set(attendance.filter((a) => a.completed).map((a) => a.date)).size;
    const avgPerDay = uniqueDays > 0 ? Math.round((masteredCount / uniqueDays) * 10) / 10 : 0;

    return NextResponse.json({
      currentDay: Number.parseInt(config.CurrentDay || '1', 10) || 1,
      totalDays: Number.parseInt(config.TotalDays || '10', 10) || 10,
      wordsPerDay: Number.parseInt(config.WordsPerDay || '10', 10) || 10,
      totalWrong: wrongWords.filter((w) => !w.mastered).length,
      masteredCount,
      streak,
      schedule,
      recentWrong,
      avgPerDay,
      totalStudyDays: uniqueDays,
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return apiError(
      'DEPENDENCY_ERROR',
      'Failed to fetch user statistics',
      process.env.NODE_ENV === 'development'
        ? { details: error instanceof Error ? error.message : String(error) }
        : undefined,
    );
  }
}

