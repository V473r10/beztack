import { db, member as memberTable, organization as organizationTable } from "@beztack/db";
import { and, eq } from "drizzle-orm";
import { env } from "@/env";
import type { OrganizationMembership } from "./contract";
import { createOrganizationAccess, parseAppAdminEmails } from "./implementation";

async function findMembership(
  userId: string,
  organizationId: string,
): Promise<OrganizationMembership | null> {
  const [row] = await db
    .select({
      organizationId: memberTable.organizationId,
      userId: memberTable.userId,
      role: memberTable.role,
      billingManagedByRole: organizationTable.billingManagedByRole,
    })
    .from(memberTable)
    .innerJoin(organizationTable, eq(memberTable.organizationId, organizationTable.id))
    .where(and(eq(memberTable.userId, userId), eq(memberTable.organizationId, organizationId)))
    .limit(1);

  return row ?? null;
}

/** The `APP_ADMIN_EMAILS` allowlist, normalized. */
export function getAppAdminEmails(): string[] {
  return parseAppAdminEmails(env.APP_ADMIN_EMAILS);
}

/** The API's Organization access, on the real database and `APP_ADMIN_EMAILS`. */
export const organizationAccess = createOrganizationAccess({
  appAdminEmails: getAppAdminEmails(),
  findMembership,
});
