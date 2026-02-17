import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireAdmin } from '@/lib/auth-middleware';
import { apiError } from '@/lib/api-contract';
import { checkRateLimit, responseRateLimited } from '@/lib/request-policy';

// GET /api/my/admin - Return whether authenticated user is admin
export async function GET(request: NextRequest) {
  try {
    const rate = checkRateLimit('api:my:admin', request, {
      maxRequests: 120,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return responseRateLimited(rate.retryAfter || 1, 'api:my:admin');
    }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return apiError('UNAUTHORIZED', 'Authentication required');
    const { user } = authResult;

    return NextResponse.json({ isAdmin: requireAdmin(user.email) });
  } catch (error) {
    console.error('Admin check error:', error);
    return apiError(
      'DEPENDENCY_ERROR',
      'Failed to check admin status',
      process.env.NODE_ENV === 'development'
        ? { details: error instanceof Error ? error.message : String(error) }
        : undefined,
    );
  }
}

