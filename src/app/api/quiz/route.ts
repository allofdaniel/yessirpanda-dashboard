import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase';
import type { QuizAnswer } from '@/lib/types';
import { requireAuth, sanitizeDay, verifyEmailOwnership } from '@/lib/auth-middleware';
import {
  apiError,
  parseDay,
  parseFailureToResponse,
  parseJsonRequest,
  parseEmail,
  parseQuizAnswers,
  parseQuizType,
} from '@/lib/api-contract';
import { checkRateLimit, responseRateLimited } from '@/lib/request-policy';

interface QuizPostBody {
  email: string;
  day: number;
  quiz_type?: string;
  results: QuizAnswer[];
}

// GET /api/quiz - Retrieve user's quiz history
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return apiError('UNAUTHORIZED', 'Authentication required');
    const { user } = authResult;

    const { searchParams } = new URL(request.url);
    const emailParam = searchParams.get('email');
    const dayParam = searchParams.get('day');

    const email = sanitizeEmail(emailParam);
    if (!email) {
      return apiError('INVALID_INPUT', 'Valid email is required');
    }

    if (!verifyEmailOwnership(user.email, email)) {
      return apiError('FORBIDDEN', 'You can only access your own quiz history');
    }

    const supabase = getServerClient();
    let query = supabase
      .from('quiz_results')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false });

    if (dayParam !== null) {
      const day = sanitizeDay(dayParam);
      if (!day) {
        return apiError('INVALID_INPUT', 'Invalid day parameter');
      }
      query = query.eq('day', day);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch quiz results:', error);
      return apiError('DEPENDENCY_ERROR', 'Failed to fetch quiz results', error.message);
    }

    return NextResponse.json({ results: data || [] });
  } catch (error) {
    console.error('Quiz history fetch error:', error);
    return apiError('DEPENDENCY_ERROR', 'Failed to fetch quiz history');
  }
}

// POST /api/quiz - Submit quiz results
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return apiError('UNAUTHORIZED', 'Authentication required');
    const { user } = authResult;
    
    const rate = checkRateLimit('api:quiz:submit', request, {
      maxRequests: 30,
      windowMs: 60_000,
    });

    if (!rate.allowed) {
      return responseRateLimited(rate.retryAfter || 1, 'api:quiz:submit');
    }

    const parsed = await parseJsonRequest<QuizPostBody>(request, {
      email: { required: true, parse: parseEmail },
      day: {
        required: true,
        parse: (raw) => {
          const parsedDay = parseDay(raw);
          if (!parsedDay.success) {
            return parsedDay;
          }
          return { success: true, value: parsedDay.value };
        },
      },
      quiz_type: { required: false, parse: parseQuizType },
      results: {
        required: true,
        parse: parseQuizAnswers,
      },
    });

    if (!parsed.success) {
      return parseFailureToResponse(parsed);
    }

    const email = parsed.value.email;
    const day = parsed.value.day;
    const normalizedResults = parsed.value.results;
    const quizType = parsed.value.quiz_type || 'lunch';

    if (!verifyEmailOwnership(user.email, email)) {
      return apiError('FORBIDDEN', 'You can only submit your own quiz results');
    }

    const supabase = getServerClient();
    const now = new Date().toISOString();

    const score = normalizedResults.filter((r) => r.memorized).length;
    const total = normalizedResults.length;

    const { error: quizError } = await supabase.from('quiz_results').insert({
      email,
      day,
      quiz_type: quizType,
      score,
      total,
      answers: normalizedResults,
      created_at: now,
    });

    if (quizError) {
      console.error('Failed to save quiz results:', quizError);
      return apiError('DEPENDENCY_ERROR', 'Failed to save quiz results', quizError.message);
    }

    const legacyRows = normalizedResults.map((r) => ({
      email,
      day,
      quiz_type: quizType,
      word: r.word,
      correct_answer: r.meaning,
      user_answer: r.memorized ? r.meaning : '',
      is_correct: r.memorized,
      timestamp: now,
    }));

    const { error: legacyError } = await supabase.from('results').insert(legacyRows);
    if (legacyError) {
      console.error('Failed to save legacy results:', legacyError);
      return apiError('DEPENDENCY_ERROR', 'Failed to save legacy results', legacyError.message);
    }

    for (const r of normalizedResults) {
      if (r.memorized) {
        const { data: existing, error: existingError } = await supabase
          .from('wrong_words')
          .select('id')
          .eq('email', email)
          .eq('word', r.word)
          .single();

        if (existingError && existingError.code !== 'PGRST116') {
          console.error('Failed to fetch wrong word state:', existingError);
          return apiError('DEPENDENCY_ERROR', 'Failed to update wrong word progress');
        }

        if (existing) {
          const { error: masteredError } = await supabase
            .from('wrong_words')
            .update({ mastered: true })
            .eq('email', email)
            .eq('word', r.word);

          if (masteredError) {
            console.error('Failed to mark word as mastered:', masteredError);
            return apiError('DEPENDENCY_ERROR', 'Failed to update wrong word progress', masteredError.message);
          }
        }
      } else {
        const { data: existing, error: existingError } = await supabase
          .from('wrong_words')
          .select('wrong_count')
          .eq('email', email)
          .eq('word', r.word)
          .single();

        if (existingError && existingError.code !== 'PGRST116') {
          console.error('Failed to fetch wrong word state:', existingError);
          return apiError('DEPENDENCY_ERROR', 'Failed to update wrong word progress');
        }

        const currentCount = existing?.wrong_count || 0;

        const { error: wrongWordError } = await supabase.from('wrong_words').upsert(
          {
            email,
            word: r.word,
            meaning: r.meaning,
            wrong_count: currentCount + 1,
            last_wrong: now,
            mastered: false,
          },
          { onConflict: 'email,word' }
        );

        if (wrongWordError) {
          console.error('Failed to upsert wrong word:', wrongWordError);
          return apiError('DEPENDENCY_ERROR', 'Failed to update wrong word progress', wrongWordError.message);
        }
      }
    }

    const { error: attendanceError } = await supabase.from('attendance').upsert(
      {
        email,
        date: now.slice(0, 10),
        type: quizType,
        completed: true,
      },
      { onConflict: 'email,date,type' }
    );

    if (attendanceError) {
      console.error('Failed to record attendance:', attendanceError);
      return apiError('DEPENDENCY_ERROR', 'Failed to record attendance', attendanceError.message);
    }

    return NextResponse.json({
      success: true,
      score,
      total,
      memorized: score,
      relearn: total - score,
    });
  } catch (error) {
    console.error('Quiz submission error:', error);
    return apiError('DEPENDENCY_ERROR', 'Failed to submit quiz');
  }
}
