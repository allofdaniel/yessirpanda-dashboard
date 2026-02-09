// Authentication middleware for API routes
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    id: string;
    email: string;
  };
}

/**
 * Middleware to verify user authentication
 * Returns user info if authenticated, otherwise returns 401 error response
 */
export async function requireAuth(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _request: NextRequest
): Promise<{ user: { id: string; email: string } } | NextResponse> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Cookie setting can fail in middleware
            }
          },
        },
      }
    );

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user || !user.email) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    return { user: { id: user.id, email: user.email } };
  } catch (error) {
    console.error('Authentication error:', error);
    return NextResponse.json(
      { error: 'Authentication failed', message: 'Unable to verify credentials' },
      { status: 401 }
    );
  }
}

/**
 * Verify that the authenticated user can only access their own data
 * Prevents horizontal privilege escalation
 */
export function verifyEmailOwnership(
  authenticatedEmail: string,
  requestedEmail: string | null
): boolean {
  if (!requestedEmail) {
    return false;
  }
  return authenticatedEmail.toLowerCase() === requestedEmail.toLowerCase();
}

/**
 * Sanitize email input to prevent injection attacks
 */
export function sanitizeEmail(email: string | null): string | null {
  if (!email) return null;

  // Basic email validation regex
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  const trimmed = email.trim().toLowerCase();

  if (!emailRegex.test(trimmed)) {
    return null;
  }

  // Prevent excessively long emails
  if (trimmed.length > 320) {
    return null;
  }

  return trimmed;
}

/**
 * Validate and sanitize day parameter
 */
export function sanitizeDay(day: string | number | null): number | null {
  if (day === null || day === undefined) return null;

  const dayNum = typeof day === 'string' ? parseInt(day, 10) : day;

  if (isNaN(dayNum) || !Number.isInteger(dayNum)) {
    return null;
  }

  // Reasonable bounds for day number
  if (dayNum < 1 || dayNum > 10000) {
    return null;
  }

  return dayNum;
}
