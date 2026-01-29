import { NextRequest, NextResponse } from 'next/server';
import { getWrongWords, updateWrongWord } from '@/lib/sheets';

// GET /api/wrong?email=X - Get wrong words (optionally filtered by email)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');

    const wrongWords = email 
      ? await getWrongWords(email) 
      : await getWrongWords();

    return NextResponse.json(wrongWords);
  } catch (error) {
    console.error('Error fetching wrong words:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wrong words' },
      { status: 500 }
    );
  }
}

// POST /api/wrong - Update wrong word
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, word, data } = body;

    if (!email || !word || !data) {
      return NextResponse.json(
        { error: 'Missing required fields: email, word, data' },
        { status: 400 }
      );
    }

    await updateWrongWord(email, word, data);
    return NextResponse.json({ success: true, email, word });
  } catch (error) {
    console.error('Error updating wrong word:', error);
    return NextResponse.json(
      { error: 'Failed to update wrong word' },
      { status: 500 }
    );
  }
}
