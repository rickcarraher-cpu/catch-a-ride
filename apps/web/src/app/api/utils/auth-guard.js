import { auth } from "@/auth";

/**
 * Shared middleware to protect API routes requiring authentication.
 * Returns a 401 response if the user is not authenticated.
 *
 * Usage:
 *   const authCheck = await requireAuth();
 *   if (authCheck.error) return authCheck.error;
 *   const session = authCheck.session;
 */
export async function requireAuth() {
  const session = await auth();

  if (!session || !session.user?.email) {
    return {
      error: Response.json(
        { error: "Unauthorized - authentication required" },
        { status: 401 },
      ),
      session: null,
    };
  }

  return { error: null, session };
}

/**
 * Optional auth - returns session if available, but doesn't block unauthenticated requests.
 * Useful for routes that want to know who the user is but don't require auth.
 */
export async function optionalAuth() {
  const session = await auth();
  return session;
}
