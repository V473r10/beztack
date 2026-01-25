import { createError, type EventHandler, type H3Event } from "h3";
import { auth } from "./auth";

// =============================================================================
// Types
// =============================================================================

type Session = Awaited<ReturnType<typeof auth.api.getSession>>;
type AuthenticatedSession = NonNullable<Session>;

// =============================================================================
// Helpers
// =============================================================================

/**
 * Check if a user has admin role
 */
function isAdmin(session: AuthenticatedSession): boolean {
  const role = session.user?.role;
  return role === "admin" || (Array.isArray(role) && role.includes("admin"));
}

/**
 * Get authenticated session or throw 401
 */
async function getAuthenticatedSession(
  event: H3Event
): Promise<AuthenticatedSession> {
  const session = await auth.api.getSession({ headers: event.headers });

  if (!session) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  event.context.auth = session;
  return session;
}

// =============================================================================
// Middleware
// =============================================================================

/**
 * Middleware to require authentication for a route.
 * Saves the session to event.context.auth for later use.
 *
 * @example
 * ```typescript
 * export default defineEventHandler(async (event) => {
 *   await requireAuth(event);
 *   const session = event.context.auth;
 *   // ... authenticated logic
 * });
 * ```
 */
export const requireAuth: EventHandler = async (event: H3Event) => {
  await getAuthenticatedSession(event);
};

/**
 * Middleware to require admin role.
 * Throws 401 if not authenticated, 403 if not admin.
 *
 * @example
 * ```typescript
 * export default defineEventHandler(async (event) => {
 *   await requireAdmin(event);
 *   // ... admin-only logic
 * });
 * ```
 */
export const requireAdmin: EventHandler = async (event: H3Event) => {
  const session = await getAuthenticatedSession(event);

  if (!isAdmin(session)) {
    throw createError({
      statusCode: 403,
      statusMessage: "Admin access required",
    });
  }
};

/**
 * Check if the authenticated user owns a resource or is an admin.
 * Useful for protecting user-specific resources while allowing admin override.
 *
 * @param event - H3 event
 * @param resourceOwnerId - The user ID that owns the resource
 * @throws 401 if not authenticated
 * @throws 403 if not owner and not admin
 *
 * @example
 * ```typescript
 * export default defineEventHandler(async (event) => {
 *   const subscriptionId = getRouterParam(event, "id");
 *   const subscription = await getSubscription(subscriptionId);
 *   await requireOwnerOrAdmin(event, subscription.userId);
 *   // ... update subscription
 * });
 * ```
 */
export async function requireOwnerOrAdmin(
  event: H3Event,
  resourceOwnerId: string | null | undefined
): Promise<AuthenticatedSession> {
  const session = await getAuthenticatedSession(event);

  const isOwner = resourceOwnerId && session.user?.id === resourceOwnerId;
  const userIsAdmin = isAdmin(session);

  if (!(isOwner || userIsAdmin)) {
    throw createError({
      statusCode: 403,
      statusMessage: "Access denied",
    });
  }

  return session;
}

/**
 * Get current session without requiring authentication.
 * Returns null if not authenticated.
 *
 * @example
 * ```typescript
 * export default defineEventHandler(async (event) => {
 *   const session = await getOptionalSession(event);
 *   if (session) {
 *     // ... authenticated logic
 *   } else {
 *     // ... anonymous logic
 *   }
 * });
 * ```
 */
export async function getOptionalSession(
  event: H3Event
): Promise<Session | null> {
  const session = await auth.api.getSession({ headers: event.headers });
  if (session) {
    event.context.auth = session;
  }
  return session;
}
