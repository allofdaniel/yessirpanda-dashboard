import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { apiError, parseEmail, parseFailureToResponse, parseJsonRequest, parseText } from '@/lib/api-contract';
import { checkRateLimit, responseRateLimited } from '@/lib/request-policy';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const INTERNAL_SECRET = process.env.RESEND_INTERNAL_SECRET;

interface AddContactBody {
  email: string;
  name: string;
}

function validateInternalSecret(request: NextRequest): boolean {
  if (!INTERNAL_SECRET) {
    if (process.env.NODE_ENV !== 'production') return true;
    console.error('RESEND_INTERNAL_SECRET is required in production');
    return false;
  }

  const provided = request.headers.get('x-resend-internal-secret');
  if (!provided) return false;

  const expected = Buffer.from(INTERNAL_SECRET, 'utf8');
  const actual = Buffer.from(provided, 'utf8');
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

// Add a contact to Resend audience
export async function POST(request: NextRequest) {
  const rate = checkRateLimit('api:resend:add-contact', request, {
    maxRequests: 30,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return responseRateLimited(rate.retryAfter || 1, 'api:resend:add-contact');
  }

  if (!validateInternalSecret(request)) {
    return apiError('FORBIDDEN', 'Unauthorized');
  }

  try {
    const parsed = await parseJsonRequest<AddContactBody>(request, {
      email: { required: true, parse: parseEmail },
      name: {
        required: false,
        parse: (value) => parseText(value, { maxLength: 80, allowEmpty: true }),
      },
    });

    if (!parsed.success) {
      return parseFailureToResponse(parsed);
    }

    const { email } = parsed.value;
    const name = parsed.value.name || '사용자';

    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY not configured');
      return apiError('CONFIG_MISSING', 'Resend not configured');
    }

    // First, get or create audience
    const audiencesRes = await fetch('https://api.resend.com/audiences', {
      headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
    });

    if (!audiencesRes.ok) {
      const errorData = await audiencesRes.json().catch(() => null);
      console.error('Failed to fetch audiences:', errorData || audiencesRes.statusText);
      return apiError('DEPENDENCY_ERROR', 'Failed to get audiences from Resend', {
        status: audiencesRes.status,
      });
    }

    let audienceId: string | null = null;
    const { data: audiences } = await audiencesRes.json();
    const yessirpandaAudience = audiences?.find((a: { name: string }) => a.name === 'yessirpanda');

    if (yessirpandaAudience) {
      audienceId = yessirpandaAudience.id;
    } else {
      const createRes = await fetch('https://api.resend.com/audiences', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'yessirpanda' }),
      });

      if (createRes.ok) {
        const { id } = await createRes.json();
        audienceId = id;
      } else {
        const createErr = await createRes.json().catch(() => null);
        return apiError('DEPENDENCY_ERROR', 'Failed to create audience', {
          status: createRes.status,
          details: createErr,
        });
      }
    }

    if (!audienceId) {
      return apiError('DEPENDENCY_ERROR', 'Failed to resolve Resend audience ID');
    }

    // Add contact to audience
    const contactRes = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        first_name: name,
        unsubscribed: false,
      }),
    });

    if (!contactRes.ok) {
      const errorData = await contactRes.json().catch(() => null);
      const message = typeof errorData?.message === 'string' ? errorData.message : undefined;
      if (message?.includes('already exists')) {
        return NextResponse.json({ success: true, message: 'Contact already exists' });
      }
      console.error('Failed to add contact:', errorData);
      return apiError('DEPENDENCY_ERROR', 'Failed to add contact', {
        status: contactRes.status,
      });
    }

    const contactData = await contactRes.json();
    return NextResponse.json({ success: true, contactId: contactData.id });
  } catch (error) {
    console.error('Error adding contact to Resend:', error);
    return apiError('DEPENDENCY_ERROR', error instanceof Error ? error.message : 'Internal server error');
  }
}

