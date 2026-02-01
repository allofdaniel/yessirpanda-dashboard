import { NextRequest, NextResponse } from 'next/server';
import { getAttendance, addAttendance } from '@/lib/db';

// GET /api/attendance?email=X - Get attendance (optionally filtered by email)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email') || undefined;

    const attendance = await getAttendance(email);
    return NextResponse.json(attendance);
  } catch (error) {
    console.error('Error fetching attendance:', error);
    return NextResponse.json(
      { error: 'Failed to fetch attendance' },
      { status: 500 }
    );
  }
}

// POST /api/attendance - Add attendance record
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, date, type } = body;

    if (!email || !date || !type) {
      return NextResponse.json(
        { error: 'Missing required fields: email, date, type' },
        { status: 400 }
      );
    }

    if (!['morning', 'lunch', 'evening'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be: morning, lunch, or evening' },
        { status: 400 }
      );
    }

    await addAttendance(email, date, type);
    return NextResponse.json({ success: true, email, date, type });
  } catch (error) {
    console.error('Error adding attendance:', error);
    return NextResponse.json(
      { error: 'Failed to add attendance' },
      { status: 500 }
    );
  }
}
