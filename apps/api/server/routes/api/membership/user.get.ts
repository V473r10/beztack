import { eq } from "drizzle-orm";
import { createError, defineEventHandler } from "h3";
import { db, schema } from "@beztack/db";
import { auth } from "@/server/utils/auth";

/**
 * Get current user's membership status
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

    // Get user with membership info
    const user = await db
      .select({
        id: schema.user.id,
        name: schema.user.name,
        email: schema.user.email,
        subscriptionTier: schema.user.subscriptionTier,
        subscriptionStatus: schema.user.subscriptionStatus,
        subscriptionId: schema.user.subscriptionId,
        polarCustomerId: schema.user.polarCustomerId,
        subscriptionValidUntil: schema.user.subscriptionValidUntil,
      })
      .from(schema.user)
      .where(eq(schema.user.id, session.user.id))
      .limit(1);

    if (user.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: "User not found",
      });
    }

    const userData = user[0];
    const now = new Date();
    const isSubscriptionActive =
      userData.subscriptionStatus === "active" &&
      (!userData.subscriptionValidUntil ||
        userData.subscriptionValidUntil > now);

    // Get user's organizations
    const organizations = await db
      .select({
        organizationId: schema.organization.id,
        organizationName: schema.organization.name,
        organizationSlug: schema.organization.slug,
        subscriptionTier: schema.organization.subscriptionTier,
        subscriptionStatus: schema.organization.subscriptionStatus,
        memberRole: schema.member.role,
      })
      .from(schema.member)
      .innerJoin(
        schema.organization,
        eq(schema.member.organizationId, schema.organization.id)
      )
      .where(eq(schema.member.userId, session.user.id));

    return {
      user: {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        tier: userData.subscriptionTier || "free",
        status: userData.subscriptionStatus || "inactive",
        subscriptionId: userData.subscriptionId,
        isActive: isSubscriptionActive,
        validUntil: userData.subscriptionValidUntil,
        hasPolarCustomer: !!userData.polarCustomerId,
      },
      organizations: organizations.map((org) => ({
        id: org.organizationId,
        name: org.organizationName,
        slug: org.organizationSlug,
        tier: org.subscriptionTier || "free",
        status: org.subscriptionStatus || "inactive",
        memberRole: org.memberRole,
      })),
    };
  } catch (error) {
    if (error.statusCode) {
      throw error;
    }
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to retrieve user membership",
    });
  }
});
