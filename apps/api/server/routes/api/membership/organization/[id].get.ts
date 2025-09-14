import { eq } from "drizzle-orm";
import { createError, defineEventHandler, getRouterParam } from "h3";
import { db } from "@/db/db";
import { schema } from "@/db/schema";
import { auth } from "@/server/utils/auth";

/**
 * Get organization membership status
 */
export default defineEventHandler(async (event) => {
  try {
    // Get the session to verify the user is authenticated
    const session = await auth.api.getSession({ headers: event.headers });

    if (!session?.user) {
      throw createError({
        statusCode: 401,
        statusMessage: "Authentication required",
      });
    }

    const organizationId = getRouterParam(event, "id");
    if (!organizationId) {
      throw createError({
        statusCode: 400,
        statusMessage: "Organization ID is required",
      });
    }

    // Get organization with membership info
    const organization = await db
      .select({
        id: schema.organization.id,
        name: schema.organization.name,
        slug: schema.organization.slug,
        subscriptionTier: schema.organization.subscriptionTier,
        subscriptionStatus: schema.organization.subscriptionStatus,
        subscriptionId: schema.organization.subscriptionId,
        polarCustomerId: schema.organization.polarCustomerId,
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

    // Check if user is a member of this organization
    const membership = await db
      .select()
      .from(schema.member)
      .where(eq(schema.member.organizationId, organizationId))
      .where(eq(schema.member.userId, session.user.id))
      .limit(1);

    if (membership.length === 0) {
      throw createError({
        statusCode: 403,
        statusMessage:
          "Access denied: You are not a member of this organization",
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
      memberRole: membership[0].role,
    };
  } catch (error) {
    if (error.statusCode) {
      throw error;
    }

    console.error("Failed to get organization membership:", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to retrieve organization membership",
    });
  }
});
