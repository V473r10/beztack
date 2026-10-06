import type { Subscription } from "@/lib/payments/types";

/**
 * Organization access: may this caller act on this Organization or Subscription?
 *
 * Decisions recorded here (grilling #45):
 * - App admin = `sudo` App role AND an email on the `APP_ADMIN_EMAILS`
 *   allowlist. Either half alone grants nothing.
 * - App admin gives NO Organization role. An App admin who is not a member of
 *   an Organization is refused by every Organization guard. The only
 *   exceptions are billing ones: the Billing manager gate
 *   (`canManageBilling`), Subscription ownership and Admin tier override.
 * - Organization roles rank `member < admin < owner`; Organization admin means
 *   `admin` or higher.
 */

/** The signed-in caller, as better-auth's session user exposes it. */
export type OrganizationAccessActor = {
  id: string;
  email: string;
  /** App role value (string, comma-separated string or array). */
  role?: unknown;
};

/** The caller's membership in one Organization. */
export type OrganizationMembership = {
  organizationId: string;
  userId: string;
  /** Organization role value as better-auth stores it. */
  role: string;
  /** Organization role that manages billing; `null` means the default. */
  billingManagedByRole: string | null;
};

export type SubscriptionMode = "user" | "organization";

/** What Subscription ownership looks at: the caller and their session. */
export type SubscriptionOwnershipActor = OrganizationAccessActor & {
  activeOrganizationId?: string | null;
};

export type OrganizationAccessErrorCode = "not-a-member" | "not-an-organization-admin";

/** A guard refused the caller. Always a 403: the caller is signed in. */
export class OrganizationAccessError extends Error {
  readonly statusCode = 403;
  readonly code: OrganizationAccessErrorCode;

  constructor(code: OrganizationAccessErrorCode, message: string) {
    super(message);
    this.name = "OrganizationAccessError";
    this.code = code;
  }
}

export interface OrganizationAccess {
  /** `sudo` AND an allowlisted email. */
  isAppAdmin(actor: Pick<OrganizationAccessActor, "email" | "role">): boolean;

  /** The caller's membership, or `null` when they are not a member. */
  findMembership(userId: string, organizationId: string): Promise<OrganizationMembership | null>;

  /** Member of the Organization, any role. App admin does not count. */
  requireMember(
    actor: OrganizationAccessActor,
    organizationId: string,
  ): Promise<OrganizationMembership>;

  /** Organization admin (`admin` or `owner`). App admin does not count. */
  requireOrganizationAdmin(
    actor: OrganizationAccessActor,
    organizationId: string,
  ): Promise<OrganizationMembership>;

  /**
   * Billing manager: the member's Organization role ranks at least as high as
   * the Organization's billing role (default `owner`). Membership only.
   */
  isBillingManager(input: { userId: string; organizationId: string }): Promise<boolean>;

  /**
   * The Billing manager gate on every billing route: App admin, or Billing
   * manager of the given Organization. No Organization means no access unless
   * App admin.
   */
  canManageBilling(
    actor: OrganizationAccessActor,
    organizationId: string | null | undefined,
  ): Promise<boolean>;

  /** Whether the caller may read or manage this Subscription. */
  ownsSubscription(
    actor: SubscriptionOwnershipActor,
    subscription: Subscription,
    mode: SubscriptionMode,
  ): boolean;
}
