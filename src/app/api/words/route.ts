import { NextRequest, NextResponse } from 'next/server';
import { getWords, getAllWords } from '@/lib/sheets';

// GET /api/words?day=N - Get words (optionally filtered by day)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const dayParam = searchParams.get('day');

    let words;
    if (dayParam) {
      const day = parseInt(dayParam);
      if (isNaN(day)) {
        return NextResponse.json(
          { error: 'Invalid day parameter' },
          { status: 400 }
        );
      }
      words = await getWords(day);
    } else {
      words = await getAllWords();
    }

    return NextResponse.json(words);
  } catch (error) {
    console.error('Error fetching words:', error);
    return NextResponse.json(
      { error: 'Failed to fetch words' },
      { status: 500 }
    );
  }
}
