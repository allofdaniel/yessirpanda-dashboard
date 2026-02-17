import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireAdmin } from '@/lib/auth-middleware';
import { apiError, parseFailureToResponse, parseJsonRequest } from '@/lib/api-contract';
import { checkRateLimit, responseRateLimited } from '@/lib/request-policy';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const VALID_WORKFLOWS = ['morning-words', 'morning-test', 'lunch-test', 'evening-review'];

interface TriggerRequest {
  workflow: string;
}

function isValidWorkflow(raw: unknown) {
  if (typeof raw !== 'string') {
    return { success: false, message: 'workflow must be a string' };
  }

  const normalized = raw.trim();
  if (!normalized) {
    return { success: false, message: 'workflow is required' };
  }

  if (!VALID_WORKFLOWS.includes(normalized)) {
    return {
      success: false,
      message: `workflow must be one of: ${VALID_WORKFLOWS.join(', ')}`,
    };
  }

  return { success: true, value: normalized };
}

// POST /api/trigger - Trigger a Supabase Edge Function
export async function POST(request: NextRequest) {
  const rate = checkRateLimit('admin:trigger', request, {
    maxRequests: 20,
    windowMs: 60_000,
  });

  if (!rate.allowed) {
    return responseRateLimited(rate.retryAfter || 1, 'admin:trigger');
  }

  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return apiError('UNAUTHORIZED', 'Authentication required');
    }
    const { user } = authResult;

    if (!requireAdmin(user.email)) {
      return apiError('FORBIDDEN', 'Admin access required');
    }

    const parsed = await parseJsonRequest<TriggerRequest>(request, {
      workflow: {
        required: true,
        parse: (value) => {
          const parsedWorkflow = isValidWorkflow(value);
          if (!parsedWorkflow.success) {
            return {
              success: false,
              code: 'INVALID_WORKFLOW',
              message: parsedWorkflow.message,
            };
          }

          return { success: true, value: parsedWorkflow.value };
        },
      },
    });

    if (!parsed.success) {
      return parseFailureToResponse(parsed);
    }

    const { workflow } = parsed.value;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return apiError('CONFIG_MISSING', 'SUPABASE configuration is missing');
    }

    const functionUrl = `${SUPABASE_URL}/functions/v1/${workflow}`;
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'dashboard',
        triggeredAt: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return apiError('DEPENDENCY_ERROR', `Edge Function failed (${response.status}): ${text}`, undefined, 502);
    }

    const result = await response.json();
    return NextResponse.json({ success: true, workflow, result });
  } catch (error) {
    console.error('Error triggering workflow:', error);
    return apiError('DEPENDENCY_ERROR', 'Failed to trigger workflow', {
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
