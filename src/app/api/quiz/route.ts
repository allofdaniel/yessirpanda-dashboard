import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase';
import type { QuizAnswer } from '@/lib/types';
import { requireAuth, verifyEmailOwnership, sanitizeEmail, sanitizeDay } from '@/lib/auth-middleware';

// GET /api/quiz - Retrieve user's quiz history
export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { searchParams } = new URL(request.url);
    const emailParam = searchParams.get('email');
    const dayParam = searchParams.get('day');

    const email = sanitizeEmail(emailParam);
    if (!email) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    // Verify user can only access their own quiz history
    if (!verifyEmailOwnership(user.email, email)) {
      return NextResponse.json({ error: 'Forbidden', message: 'You can only access your own quiz history' }, { status: 403 });
    }

    const supabase = getServerClient();
    let query = supabase
      .from('quiz_results')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false });

    if (dayParam) {
      const day = sanitizeDay(dayParam);
      if (day) {
        query = query.eq('day', day);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch quiz results:', error);
      return NextResponse.json({ error: 'Failed to fetch quiz results' }, { status: 500 });
    }

    return NextResponse.json({ results: data || [] });
  } catch (error) {
    console.error('Quiz history fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch quiz history' }, { status: 500 });
  }
}

// POST /api/quiz - Submit quiz results
export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json();
    const { email: emailParam, day: dayParam, quiz_type, results } = body as {
      email: string;
      day: number;
      quiz_type?: 'morning' | 'lunch' | 'evening';
      results: QuizAnswer[];
    };

    const email = sanitizeEmail(emailParam);
    const day = sanitizeDay(dayParam);

    if (!email || !day || !results || !Array.isArray(results)) {
      return NextResponse.json({ error: 'Missing or invalid required fields' }, { status: 400 });
    }

    // Verify user can only submit their own quiz results
    if (!verifyEmailOwnership(user.email, email)) {
      return NextResponse.json({ error: 'Forbidden', message: 'You can only submit your own quiz results' }, { status: 403 });
    }

    // Validate quiz_type
    if (quiz_type && !['morning', 'lunch', 'evening'].includes(quiz_type)) {
      return NextResponse.json({ error: 'Invalid quiz_type' }, { status: 400 });
    }

    const supabase = getServerClient();
    const now = new Date().toISOString();
    const quizType = quiz_type || 'lunch';

    // Calculate score
    const score = results.filter(r => r.memorized).length;
    const total = results.length;

    // Save to quiz_results table (new consolidated table)
    const { error: quizError } = await supabase.from('quiz_results').insert({
      email,
      day,
      quiz_type: quizType,
      score,
      total,
      answers: results,
      created_at: now,
    });

    if (quizError) {
      console.error('Failed to save quiz results:', quizError);
      return NextResponse.json({ error: 'Failed to save quiz results' }, { status: 500 });
    }

    // Also save to legacy results table for backward compatibility
    for (const r of results) {
      await supabase.from('results').insert({
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

    // Update wrong_words table
    for (const r of results) {
      if (r.memorized) {
        // Mark as mastered if it was previously wrong
        const { data: existing } = await supabase
          .from('wrong_words')
          .select('id')
          .eq('email', email)
          .eq('word', r.word)
          .single();

        if (existing) {
          await supabase
            .from('wrong_words')
            .update({ mastered: true })
            .eq('email', email)
            .eq('word', r.word);
        }
      } else {
        // Upsert wrong word with incremented count
        const { data: existing } = await supabase
          .from('wrong_words')
          .select('wrong_count')
          .eq('email', email)
          .eq('word', r.word)
          .single();

        const currentCount = existing?.wrong_count || 0;

        await supabase.from('wrong_words').upsert(
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
      }
    }

    // Record attendance
    await supabase.from('attendance').upsert(
      {
        email,
        date: now.slice(0, 10),
        type: quizType,
        completed: true,
      },
      { onConflict: 'email,date,type' }
    );

    return NextResponse.json({
      success: true,
      score,
      total,
      memorized: score,
      relearn: total - score,
    });
  } catch (error) {
    console.error('Quiz submission error:', error);
    return NextResponse.json({ error: 'Failed to submit quiz' }, { status: 500 });
  }
}
