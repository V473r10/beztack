import { createError, defineEventHandler, getQuery } from "h3";
import { env } from "@/env";
import { organizationAccess } from "@/server/domain/organization-access";
import { getUserMembershipStatus, requireAuth } from "@/server/utils/membership";
import { toOrganizationAccessActor } from "@/server/utils/organization-access";

export default defineEventHandler(async (event) => {
  // Require authentication
  const user = await requireAuth(event);

  // Get organization context from query params or session
  const query = getQuery(event);
  const organizationId =
    (query.organizationId as string | undefined) ?? user.session.activeOrganizationId ?? undefined;

  const actor = toOrganizationAccessActor(user);
  const isAppAdmin = organizationAccess.isAppAdmin(user.user);
  const membership = organizationId
    ? await organizationAccess.findMembership(user.user.id, organizationId)
    : null;

  // Only members (and App admins, for Admin tier override) may read an
  // Organization's Membership.
  if (organizationId && !(membership || isAppAdmin)) {
    throw createError({
      statusCode: 403,
      statusMessage: "Access denied: you are not a member of this organization",
    });
  }

  try {
    const membershipStatus = await getUserMembershipStatus(user.user.id, organizationId, {
      isAppAdmin,
      includeAdminTierOverride: isAppAdmin,
    });

    // What the UI may offer: the caller's Organization role in that
    // Organization, and whether they pass the Billing manager gate. In user
    // subscription mode everyone manages their own billing.
    const canManageBilling =
      env.SUBSCRIPTION_MODE === "organization"
        ? await organizationAccess.canManageBilling(actor, organizationId)
        : true;

    return {
      success: true,
      data: {
        userId: user.user.id,
        ...membershipStatus,
        organizationRole: membership?.role ?? null,
        canManageBilling,
      },
    };
  } catch (_error) {
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to fetch membership status",
    });
  }
});
