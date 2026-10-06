import { db, schema } from "@beztack/db";
import { eq } from "drizzle-orm";
import { createError, defineEventHandler, getRouterParam } from "h3";
import { requireOrganizationMember } from "@/server/utils/organization-access";

/**
 * Get organization membership status
 */
export default defineEventHandler(async (event) => {
  const organizationId = getRouterParam(event, "id");
  if (!organizationId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Organization ID is required",
    });
  }

  // 401 when signed out, 403 when not a member of this organization.
  const { membership } = await requireOrganizationMember(event, organizationId);

  try {
    const organization = await db
      .select({
        id: schema.organization.id,
        name: schema.organization.name,
        slug: schema.organization.slug,
        subscriptionTier: schema.organization.subscriptionTier,
        subscriptionStatus: schema.organization.subscriptionStatus,
        subscriptionId: schema.organization.subscriptionId,
        paymentCustomerId: schema.organization.paymentCustomerId,
        subscriptionValidUntil: schema.organization.subscriptionValidUntil,
        usageMetrics: schema.organization.usageMetrics,
      })
      .from(schema.organization)
      .where(eq(schema.organization.id, organizationId))
      .limit(1);

    if (organization.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: "Organization not found",
      });
    }

    const org = organization[0];
    const now = new Date();
    const isSubscriptionActive =
      org.subscriptionStatus === "active" &&
      (!org.subscriptionValidUntil || org.subscriptionValidUntil > now);

    return {
      organizationId: org.id,
      organizationName: org.name,
      tier: org.subscriptionTier || "free",
      status: org.subscriptionStatus || "inactive",
      subscriptionId: org.subscriptionId,
      isActive: isSubscriptionActive,
      validUntil: org.subscriptionValidUntil,
      usageMetrics: org.usageMetrics ? JSON.parse(org.usageMetrics) : null,
      memberRole: membership.role,
    };
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error && error.statusCode) {
      throw error;
    }
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to retrieve organization membership",
    });
  }
});
