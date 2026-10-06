import type { OrganizationMembership } from "./contract";
import { createOrganizationAccess, parseAppAdminEmails } from "./implementation";

export type OrganizationAccessTestWorld = {
  /** Comma-separated, like `APP_ADMIN_EMAILS`. */
  appAdminEmails?: string;
  memberships?: Array<
    Pick<OrganizationMembership, "organizationId" | "userId" | "role"> & {
      billingManagedByRole?: string | null;
    }
  >;
};

/** Organization access over a hand-written, in-memory world. No database. */
export function createOrganizationAccessTestModule(world: OrganizationAccessTestWorld = {}) {
  const memberships: OrganizationMembership[] = (world.memberships ?? []).map((membership) => ({
    ...membership,
    billingManagedByRole: membership.billingManagedByRole ?? null,
  }));

  return createOrganizationAccess({
    appAdminEmails: parseAppAdminEmails(world.appAdminEmails ?? ""),
    async findMembership(userId, organizationId) {
      return (
        memberships.find(
          (membership) =>
            membership.userId === userId && membership.organizationId === organizationId,
        ) ?? null
      );
    },
  });
}
