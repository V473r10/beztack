import { createError, defineEventHandler, getQuery } from "h3";
import { getUserMembershipStatus, requireAuth } from "@/server/utils/membership";
import { organizationAccess } from "@/server/domain/organization-access";

export default defineEventHandler(async (event) => {
  // Require authentication
  const user = await requireAuth(event);

  // Get organization context from query params or session
  const query = getQuery(event);
  const organizationId =
    (query.organizationId as string | undefined) ?? user.session.activeOrganizationId ?? undefined;

  try {
    // Get membership status
    const isAppAdmin = organizationAccess.isAppAdmin(user.user);
    const membershipStatus = await getUserMembershipStatus(user.user.id, organizationId, {
      isAppAdmin,
      includeAdminTierOverride: isAppAdmin,
    });

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
