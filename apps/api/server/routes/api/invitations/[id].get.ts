import { db, invitation as invitationTable, organization as organizationTable } from "@beztack/db";
import { eq } from "drizzle-orm";
import { createError, defineEventHandler, getRouterParam } from "h3";

/**
 * Public preview of an Invitation, for the acceptance page reached from the
 * invitation email. Anyone holding the id can call it, so it returns only what
 * the page shows: the Organization's name and logo, the Organization role, the
 * status and the expiry. Never an email address (invitee or inviter).
 */
export type InvitationPreview = {
  id: string;
  role: string;
  status: string;
  expiresAt: string;
  organization: { name: string; logo: string | null };
};

export default defineEventHandler(async (event): Promise<InvitationPreview> => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Invitation id is required" });
  }

  const [row] = await db
    .select({
      id: invitationTable.id,
      role: invitationTable.role,
      status: invitationTable.status,
      expiresAt: invitationTable.expiresAt,
      organizationName: organizationTable.name,
      organizationLogo: organizationTable.logo,
    })
    .from(invitationTable)
    .innerJoin(organizationTable, eq(invitationTable.organizationId, organizationTable.id))
    .where(eq(invitationTable.id, id))
    .limit(1);

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: "Invitation not found" });
  }

  return {
    id: row.id,
    role: row.role ?? "member",
    status: row.status,
    expiresAt: new Date(row.expiresAt).toISOString(),
    organization: { name: row.organizationName, logo: row.organizationLogo ?? null },
  };
});
