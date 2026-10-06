import { createError, defineEventHandler, getQuery } from "h3";
import { isAppAdminActor } from "@/server/utils/app-admin";
import { getUserMembershipStatus, requireAuth } from "@/server/utils/membership";
import { getAppAdminEmails } from "@/server/utils/app-admin-emails";

export default defineEventHandler(async (event) => {
  // Require authentication
  const user = await requireAuth(event);

  // Get organization context from query params or session
  const query = getQuery(event);
  const organizationId =
    (query.organizationId as string | undefined) ?? user.session.activeOrganizationId ?? undefined;

  try {
    // Get membership status
    const isAppAdmin = isAppAdminActor(user.user, getAppAdminEmails());
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
