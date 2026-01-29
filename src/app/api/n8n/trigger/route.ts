import { NextRequest, NextResponse } from 'next/server';

const N8N_WEBHOOK_BASE = process.env.N8N_WEBHOOK_BASE;

// Workflow webhook paths
const WORKFLOW_WEBHOOKS: Record<string, string> = {
  'morning-words': '/morning-words',
  'morning-test': '/morning-test',
  'lunch-test': '/lunch-test',
  'evening-review': '/evening-review',
};

// POST /api/n8n/trigger - Trigger n8n workflow
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

    if (!WORKFLOW_WEBHOOKS[workflow]) {
      return NextResponse.json(
        { 
          error: 'Invalid workflow. Must be one of: morning-words, morning-test, lunch-test, evening-review' 
        },
        { status: 400 }
      );
    }

    if (!N8N_WEBHOOK_BASE) {
      return NextResponse.json(
        { error: 'N8N_WEBHOOK_BASE environment variable not configured' },
        { status: 500 }
      );
    }

    const webhookUrl = `${N8N_WEBHOOK_BASE}${WORKFLOW_WEBHOOKS[workflow]}`;

    // Trigger the n8n webhook
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'dashboard',
        triggeredAt: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error(`n8n webhook failed with status ${response.status}`);
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      workflow,
      webhookUrl,
      result,
    });
  } catch (error) {
    console.error('Error triggering n8n workflow:', error);
    return NextResponse.json(
      { 
        error: 'Failed to trigger workflow',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
