import { NextRequest, NextResponse } from 'next/server';
import { getResults } from '@/lib/sheets';

// GET /api/results?email=X&day=N - Get results (optionally filtered by email and day)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email') || undefined;
    const dayParam = searchParams.get('day');

    let day: number | undefined;
    if (dayParam) {
      day = parseInt(dayParam);
      if (isNaN(day)) {
        return NextResponse.json(
          { error: 'Invalid day parameter' },
          { status: 400 }
        );
      }
    }

    const results = await getResults(email, day);
    return NextResponse.json(results);
  } catch (error) {
    console.error('Error fetching results:', error);
    return NextResponse.json(
      { error: 'Failed to fetch results' },
      { status: 500 }
    );
  }
}
