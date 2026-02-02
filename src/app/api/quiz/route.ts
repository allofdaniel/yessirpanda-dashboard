import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase';

// POST /api/quiz - Submit quiz results
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, day, results } = body as {
      email: string;
      day: number;
      results: { word: string; meaning: string; memorized: boolean }[];
    };

    if (!email || !day || !results || !Array.isArray(results)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = getServerClient();
    const now = new Date().toISOString();

    // Save each result to results table
    for (const r of results) {
      await supabase.from('results').insert({
        email,
        day,
        quiz_type: 'lunch',
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
        type: 'lunch',
        completed: true,
      },
      { onConflict: 'email,date,type' }
    );

    return NextResponse.json({
      success: true,
      memorized: results.filter(r => r.memorized).length,
      relearn: results.filter(r => !r.memorized).length,
    });
  } catch (error) {
    console.error('Quiz submission error:', error);
    return NextResponse.json({ error: 'Failed to submit quiz' }, { status: 500 });
  }
}
