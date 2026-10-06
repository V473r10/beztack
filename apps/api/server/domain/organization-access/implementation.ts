import {
  hasAuthRole,
  hasOrganizationRoleAtLeast,
  ORGANIZATION_ROLES,
  type OrganizationRole,
} from "@beztack/auth";
import type { Subscription } from "@/lib/payments/types";
import {
  type OrganizationAccess,
  OrganizationAccessError,
  type OrganizationMembership,
  type SubscriptionMode,
  type SubscriptionOwnershipActor,
} from "./contract";

// ---------------------------------------------------------------------------
// Pure rules. Exported for callers that must not load the production adapter
// (better-auth's own hooks in `auth-config.ts`, Admin tier override).
// ---------------------------------------------------------------------------

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Parse the comma-separated `APP_ADMIN_EMAILS` value into normalized emails. */
export function parseAppAdminEmails(value: string): string[] {
  return value.split(",").map(normalizeEmail).filter(Boolean);
}

/** Whether `email` is on the allowlist (case- and whitespace-insensitive). */
export function isAllowlistedAppAdminEmail(
  email: string | null | undefined,
  appAdminEmails: string[],
): boolean {
  if (!email) {
    return false;
  }
  return appAdminEmails.map(normalizeEmail).includes(normalizeEmail(email));
}

/** App admin: the `sudo` App role AND an allowlisted email. */
export function isAppAdminActor(
  actor: { email?: string | null; role?: unknown },
  appAdminEmails: string[],
): boolean {
  return hasAuthRole(actor.role, "sudo") && isAllowlistedAppAdminEmail(actor.email, appAdminEmails);
}

/** The Organization role that manages billing when none is configured. */
export const DEFAULT_BILLING_MANAGER_ROLE = "owner";

function isRankedOrganizationRole(role: string): role is OrganizationRole {
  return (ORGANIZATION_ROLES as readonly string[]).includes(role);
}

/**
 * Billing manager rule: the member's Organization role ranks at least as high
 * as the configured billing role (`member < admin < owner`). A configured role
 * outside that ranking (a Derived project's own role) is matched exactly, so
 * an unknown role never admits everyone.
 */
export function holdsBillingRole(memberRole: unknown, billingRole: string): boolean {
  if (isRankedOrganizationRole(billingRole)) {
    return hasOrganizationRoleAtLeast(memberRole, billingRole);
  }
  return hasAuthRole<string>(memberRole, billingRole);
}

type SubscriptionMetadata = {
  userId?: string;
  ownerEmail?: string;
  referenceId?: string;
  organizationId?: string;
};

function isSubscriptionOwnedByActor(
  actor: SubscriptionOwnershipActor,
  subscription: Subscription,
  mode: SubscriptionMode,
): boolean {
  const metadata = subscription.metadata as SubscriptionMetadata | undefined;

  if (mode === "organization") {
    const organizationId = actor.activeOrganizationId;
    if (!organizationId) {
      return false;
    }
    return metadata?.referenceId === organizationId || metadata?.organizationId === organizationId;
  }

  const email = normalizeEmail(actor.email);
  return (
    subscription.customerId === actor.id ||
    Boolean(subscription.customerEmail && normalizeEmail(subscription.customerEmail) === email) ||
    metadata?.userId === actor.id ||
    Boolean(metadata?.ownerEmail && normalizeEmail(metadata.ownerEmail) === email)
  );
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export type OrganizationAccessDependencies = {
  /** Normalized `APP_ADMIN_EMAILS`. Default: nobody is an App admin. */
  appAdminEmails?: string[];
  /** Membership lookup. Default: nobody is a member of anything. */
  findMembership?: (
    userId: string,
    organizationId: string,
  ) => Promise<OrganizationMembership | null>;
};

/** Every dependency is optional and fails closed when omitted. */
export function createOrganizationAccess(
  dependencies: OrganizationAccessDependencies = {},
): OrganizationAccess {
  const appAdminEmails = dependencies.appAdminEmails ?? [];
  const findMembership = dependencies.findMembership ?? (async () => null);

  const access: OrganizationAccess = {
    isAppAdmin(actor) {
      return isAppAdminActor(actor, appAdminEmails);
    },

    findMembership(userId, organizationId) {
      return findMembership(userId, organizationId);
    },

    async requireMember(actor, organizationId) {
      const membership = await findMembership(actor.id, organizationId);
      if (!membership) {
        throw new OrganizationAccessError(
          "not-a-member",
          "Access denied: you are not a member of this organization",
        );
      }
      return membership;
    },

    async requireOrganizationAdmin(actor, organizationId) {
      const membership = await access.requireMember(actor, organizationId);
      if (!hasOrganizationRoleAtLeast(membership.role, "admin")) {
        throw new OrganizationAccessError(
          "not-an-organization-admin",
          "Organization admin access required",
        );
      }
      return membership;
    },

    async isBillingManager({ userId, organizationId }) {
      const membership = await findMembership(userId, organizationId);
      if (!membership) {
        return false;
      }
      return holdsBillingRole(
        membership.role,
        membership.billingManagedByRole ?? DEFAULT_BILLING_MANAGER_ROLE,
      );
    },

    async canManageBilling(actor, organizationId) {
      if (isAppAdminActor(actor, appAdminEmails)) {
        return true;
      }
      if (!organizationId) {
        return false;
      }
      return await access.isBillingManager({ userId: actor.id, organizationId });
    },

    ownsSubscription(actor, subscription, mode) {
      // Billing exception: an App admin may manage any Subscription.
      if (isAppAdminActor(actor, appAdminEmails)) {
        return true;
      }
      return isSubscriptionOwnedByActor(actor, subscription, mode);
    },
  };

  return access;
}
