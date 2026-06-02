import { createError, defineEventHandler, getQuery } from "h3";
import { env } from "@/env";
import { isAppAdminActor } from "@/server/utils/admin-tier-override";
import {
  getUserMembershipStatus,
  requireAuth,
} from "@/server/utils/membership";

function getAppAdminEmails(): string[] {
  return env.APP_ADMIN_EMAILS.split(",")
    .map((email: string) => email.trim().toLowerCase())
    .filter(Boolean);
}

function getAuthRole(user: unknown): string | string[] | null {
  const role = (user as { role?: unknown }).role;
  if (typeof role === "string") {
    return role;
  }
  if (Array.isArray(role) && role.every((entry) => typeof entry === "string")) {
    return role;
  }
  return null;
}

export default defineEventHandler(async (event) => {
  // Require authentication
  const user = await requireAuth(event);

  // Get organization context from query params or session
  const query = getQuery(event);
  const organizationId =
    (query.organizationId as string | undefined) ??
    user.session.activeOrganizationId ??
    undefined;

  try {
    // Get membership status
    const isAppAdmin = isAppAdminActor(
      {
        email: user.user.email,
        id: user.user.id,
        role: getAuthRole(user.user),
      },
      getAppAdminEmails()
    );
    const membershipStatus = await getUserMembershipStatus(
      user.user.id,
      organizationId,
      {
        isAppAdmin,
        includeAdminTierOverride: isAppAdmin,
      }
    );

    return {
      success: true,
      data: {
        userId: user.user.id,
        ...membershipStatus,
      },
    };
  } catch (_error) {
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to fetch membership status",
    });
  }
});
