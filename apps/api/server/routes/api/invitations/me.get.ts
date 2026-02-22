import { and, eq } from "drizzle-orm";
import { createError, defineEventHandler } from "h3";
import { db, schema } from "@beztack/db";
import { auth } from "@/server/utils/auth";

/**
 * Get invitations for the authenticated user
 * Returns all invitations sent to the user's email address
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

    const userEmail = session.user.email;

    if (!userEmail) {
      throw createError({
        statusCode: 400,
        statusMessage: "User email not found",
      });
    }

    // Get all invitations for this user's email
    const userInvitations = await db
      .select({
        id: schema.invitation.id,
        organizationId: schema.invitation.organizationId,
        email: schema.invitation.email,
        role: schema.invitation.role,
        teamId: schema.invitation.teamId,
        status: schema.invitation.status,
        expiresAt: schema.invitation.expiresAt,
        inviterId: schema.invitation.inviterId,
        createdAt: schema.invitation.createdAt,
        updatedAt: schema.invitation.updatedAt,
        organizationName: schema.organization.name,
        organizationSlug: schema.organization.slug,
        organizationLogo: schema.organization.logo,
      })
      .from(schema.invitation)
      .leftJoin(
        schema.organization,
        eq(schema.invitation.organizationId, schema.organization.id)
      )
      .where(
        and(
          eq(schema.invitation.email, userEmail),
          eq(schema.invitation.status, "pending")
        )
      )
      .orderBy(schema.invitation.createdAt);

    // Map to the expected format
    return userInvitations.map((inv) => ({
      id: inv.id,
      organizationId: inv.organizationId,
      email: inv.email,
      role: inv.role,
      teamId: inv.teamId,
      status: inv.status,
      expiresAt: inv.expiresAt,
      inviterId: inv.inviterId,
      createdAt: inv.createdAt,
      updatedAt: inv.updatedAt,
      organization: {
        id: inv.organizationId,
        name: inv.organizationName,
        slug: inv.organizationSlug,
        logo: inv.organizationLogo,
      },
    }));
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to retrieve user invitations",
    });
  }
});
