import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const VALID_WORKFLOWS = ['morning-words', 'morning-test', 'lunch-test', 'evening-review'];

// POST /api/trigger - Trigger a Supabase Edge Function
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workflow } = body;

    if (!workflow) {
      return NextResponse.json(
        { error: 'Missing required field: workflow' },
        { status: 400 }
      );
    }

    if (!VALID_WORKFLOWS.includes(workflow)) {
      return NextResponse.json(
        { error: `Invalid workflow. Must be one of: ${VALID_WORKFLOWS.join(', ')}` },
        { status: 400 }
      );
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return NextResponse.json(
        { error: 'Supabase environment variables not configured' },
        { status: 500 }
      );
    }

    const functionUrl = `${SUPABASE_URL}/functions/v1/${workflow}`;

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'dashboard',
        triggeredAt: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Edge Function failed (${response.status}): ${text}`);
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      workflow,
      result,
    });
  } catch (error) {
    console.error('Error triggering workflow:', error);
    return NextResponse.json(
      {
        error: 'Failed to trigger workflow',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
