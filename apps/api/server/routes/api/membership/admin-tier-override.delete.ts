import { createError, defineEventHandler, getQuery } from "h3";
import { env } from "@/env";
import { clearAdminTierOverride } from "@/server/utils/admin-tier-override";
import { requireAuth } from "@/server/utils/membership";

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

function readQueryString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);
  const query = getQuery(event);
  const requestedOrganizationId = readQueryString(query.organizationId);
  const organizationId =
    env.SUBSCRIPTION_MODE === "organization"
      ? (requestedOrganizationId ??
        auth.session.activeOrganizationId ??
        undefined)
      : undefined;

  try {
    const result = await clearAdminTierOverride({
      actor: {
        email: auth.user.email,
        id: auth.user.id,
        role: getAuthRole(auth.user),
      },
      appAdminEmails: getAppAdminEmails(),
      organizationId,
      sourceAction: "global-banner",
      subscriptionMode:
        env.SUBSCRIPTION_MODE === "organization" ? "organization" : "user",
      userId: auth.user.id,
    });

    return {
      success: true,
      resultKind: "admin-tier-override-cleared",
      changed: result.changed,
      adminTierOverride: result.clearedOverride
        ? {
            target: {
              type: result.clearedOverride.targetType,
              id: result.clearedOverride.targetId,
            },
            tier: result.clearedOverride.tier,
            billingCadence: result.clearedOverride.billingCadence,
            realSubscriptionsUnchanged: true,
          }
        : null,
    };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
    ) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      statusMessage:
        error instanceof Error
          ? error.message
          : "Failed to clear Admin tier override",
    });
  }
});
