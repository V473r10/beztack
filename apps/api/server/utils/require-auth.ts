import { createError, type EventHandler, type H3Event } from "h3";
import { env } from "@/env";
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
 * Check if a user has the internal role value and is actively in APP_ADMIN_EMAILS.
 * This strict double-check mitigates role escalation vulnerabilities.
 */
function isAppAdmin(session: AuthenticatedSession): boolean {
  const role = session.user?.role;
  const hasAppAdminRole =
    role === "sudo" || (Array.isArray(role) && role.includes("sudo"));

  if (!hasAppAdminRole) {
    return false;
  }

  const appAdminEmails = env.APP_ADMIN_EMAILS.split(",")
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean);

  return appAdminEmails.includes(session.user?.email?.toLowerCase() ?? "");
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
 */
export const requireAuth: EventHandler = async (event: H3Event) => {
  await getAuthenticatedSession(event);
};

/**
 * Middleware to require App admin access.
 * Throws 401 if not authenticated, 403 if not an App admin.
 */
export const requireAdmin: EventHandler = async (event: H3Event) => {
  const session = await getAuthenticatedSession(event);

  if (!isAppAdmin(session)) {
    throw createError({
      statusCode: 403,
      statusMessage: "App admin access required",
    });
  }
};

/**
 * Check if the authenticated user owns a resource or is an App admin.
 * Useful for protecting user-specific resources while allowing platform admin override.
 */
export async function requireOwnerOrAdmin(
  event: H3Event,
  resourceOwnerId: string | null | undefined
): Promise<AuthenticatedSession> {
  const session = await getAuthenticatedSession(event);

  const isOwner = resourceOwnerId && session.user?.id === resourceOwnerId;
  const userIsAppAdmin = isAppAdmin(session);

  if (!(isOwner || userIsAppAdmin)) {
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
