import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase';
import type { QuizAnswer } from '@/lib/types';

// GET /api/quiz - Retrieve user's quiz history
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const day = searchParams.get('day');

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const supabase = getServerClient();
    let query = supabase
      .from('quiz_results')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(50); // Prevent unbounded queries

    if (day) {
      const dayNum = parseInt(day);
      if (isNaN(dayNum)) {
        return NextResponse.json({ error: 'Invalid day parameter' }, { status: 400 });
      }
      query = query.eq('day', dayNum);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch quiz results:', error);
      return NextResponse.json(
        {
          error: 'Failed to fetch quiz results',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ results: data || [] });
  } catch (error) {
    console.error('Quiz history fetch error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch quiz history',
        details: process.env.NODE_ENV === 'development'
          ? (error instanceof Error ? error.message : String(error))
          : undefined
      },
      { status: 500 }
    );
  }
}

// POST /api/quiz - Submit quiz results (OPTIMIZED - No N+1 queries)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, day, quiz_type, results } = body as {
      email: string;
      day: number;
      quiz_type?: 'morning' | 'lunch' | 'evening';
      results: QuizAnswer[];
    };

    // Validation
    if (!email || !day || !results || !Array.isArray(results)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    if (results.length === 0) {
      return NextResponse.json({ error: 'No results provided' }, { status: 400 });
    }

    const supabase = getServerClient();
    const now = new Date().toISOString();
    const quizType = quiz_type || 'lunch';

    // Calculate score
    const score = results.filter(r => r.memorized).length;
    const total = results.length;

    // ============================================================================
    // OPTIMIZATION 1: Batch fetch all existing wrong_words for this user + words
    // ============================================================================
    const words = results.map(r => r.word);
    const { data: existingWrongWords, error: fetchError } = await supabase
      .from('wrong_words')
      .select('word, wrong_count, mastered')
      .eq('email', email)
      .in('word', words);

    if (fetchError) {
      console.error('Failed to fetch existing wrong words:', fetchError);
      return NextResponse.json(
        {
          error: 'Failed to process quiz results',
          details: process.env.NODE_ENV === 'development' ? fetchError.message : undefined
        },
        { status: 500 }
      );
    }

    // Create a lookup map for existing wrong words
    const wrongWordsMap = new Map<string, { wrong_count: number; mastered: boolean }>();
    (existingWrongWords || []).forEach(w => {
      wrongWordsMap.set(w.word, { wrong_count: w.wrong_count, mastered: w.mastered });
    });

    // ============================================================================
    // OPTIMIZATION 2: Prepare batch upsert data
    // ============================================================================
    const wrongWordsToUpsert = [];
    const legacyResultsToInsert = [];

    for (const r of results) {
      const existing = wrongWordsMap.get(r.word);

      if (r.memorized) {
        // If word was previously wrong, mark as mastered
        if (existing) {
          wrongWordsToUpsert.push({
            email,
            word: r.word,
            meaning: r.meaning,
            wrong_count: existing.wrong_count, // Keep existing count
            last_wrong: now,
            mastered: true,
          });
        }
      } else {
        // Word is wrong - increment count or create new record
        const currentCount = existing?.wrong_count || 0;
        wrongWordsToUpsert.push({
          email,
          word: r.word,
          meaning: r.meaning,
          wrong_count: currentCount + 1,
          last_wrong: now,
          mastered: false,
        });
      }

      // Prepare legacy results entry
      legacyResultsToInsert.push({
        email,
        day,
        quiz_type: quizType,
        word: r.word,
        correct_answer: r.meaning,
        user_answer: r.memorized ? r.meaning : '',
        is_correct: r.memorized,
        timestamp: now,
      });
    }

    // ============================================================================
    // OPTIMIZATION 3: Execute all database operations in parallel using Promise.all
    // ============================================================================
    const [quizResultError, wrongWordsError, legacyResultsError, attendanceError] = await Promise.allSettled([
      // 1. Save to quiz_results table (new consolidated table)
      supabase.from('quiz_results').insert({
        email,
        day,
        quiz_type: quizType,
        score,
        total,
        answers: results,
        created_at: now,
      }),

      // 2. Batch upsert wrong_words (ONE query instead of N queries)
      wrongWordsToUpsert.length > 0
        ? supabase.from('wrong_words').upsert(wrongWordsToUpsert, { onConflict: 'email,word' })
        : Promise.resolve({ error: null }),

      // 3. Batch insert legacy results (ONE query instead of N queries)
      supabase.from('results').insert(legacyResultsToInsert),

      // 4. Record attendance
      supabase.from('attendance').upsert(
        {
          email,
          date: now.slice(0, 10),
          type: quizType,
          completed: true,
        },
        { onConflict: 'email,date,type' }
      ),
    ]);

    // Check for errors
    if (quizResultError.status === 'rejected' || (quizResultError.status === 'fulfilled' && quizResultError.value.error)) {
      const error = quizResultError.status === 'rejected'
        ? quizResultError.reason
        : quizResultError.value.error;
      console.error('Failed to save quiz results:', error);
      return NextResponse.json(
        {
          error: 'Failed to save quiz results',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        },
        { status: 500 }
      );
    }

    if (wrongWordsError.status === 'rejected' || (wrongWordsError.status === 'fulfilled' && wrongWordsError.value.error)) {
      const error = wrongWordsError.status === 'rejected'
        ? wrongWordsError.reason
        : wrongWordsError.value.error;
      console.error('Failed to update wrong words:', error);
      // Non-critical - continue
    }

    if (legacyResultsError.status === 'rejected' || (legacyResultsError.status === 'fulfilled' && legacyResultsError.value.error)) {
      const error = legacyResultsError.status === 'rejected'
        ? legacyResultsError.reason
        : legacyResultsError.value.error;
      console.error('Failed to save legacy results:', error);
      // Non-critical - continue
    }

    if (attendanceError.status === 'rejected' || (attendanceError.status === 'fulfilled' && attendanceError.value.error)) {
      const error = attendanceError.status === 'rejected'
        ? attendanceError.reason
        : attendanceError.value.error;
      console.error('Failed to record attendance:', error);
      // Non-critical - continue
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
    return NextResponse.json(
      {
        error: 'Failed to submit quiz',
        details: process.env.NODE_ENV === 'development'
          ? (error instanceof Error ? error.message : String(error))
          : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * PERFORMANCE COMPARISON
 *
 * OLD IMPLEMENTATION (N+1 Problem):
 * - For 10 words: 1 + (10 * 2) + 10 + 1 = 32 queries
 * - Query 1: Check existing wrong_word (×10)
 * - Query 2: Upsert wrong_word (×10)
 * - Query 3: Insert legacy result (×10)
 * - Query 4: Insert quiz_result (×1)
 * - Query 5: Upsert attendance (×1)
 *
 * NEW IMPLEMENTATION (Batched):
 * - For 10 words: 1 + 1 + 1 + 1 + 1 = 5 queries (parallel)
 * - Query 1: Batch fetch existing wrong_words
 * - Query 2: Batch upsert wrong_words
 * - Query 3: Batch insert legacy results
 * - Query 4: Insert quiz_result
 * - Query 5: Upsert attendance
 *
 * RESULT: 84% reduction in database queries!
 * Also runs faster due to parallel execution.
 */
