import { createError, type EventHandlerRequest, type H3Event } from "h3";
import {
  type OrganizationAccess,
  OrganizationAccessError,
  type OrganizationMembership,
  organizationAccess,
  type SubscriptionOwnershipActor,
} from "@/server/domain/organization-access";
import { type AuthenticatedUser, requireAuth } from "@/server/utils/membership";

/**
 * Named H3 guards over `domain/organization-access`. Routes call these instead
 * of reading `member.role` themselves, so every Organization-scoped route
 * applies the same rule (App admin gives no Organization role).
 */

export type OrganizationContext = {
  auth: AuthenticatedUser;
  organizationId: string;
  membership: OrganizationMembership;
};

type Event = H3Event<EventHandlerRequest>;

/** The caller as Organization access sees them. */
export function toOrganizationAccessActor(auth: AuthenticatedUser): SubscriptionOwnershipActor {
  return {
    id: auth.user.id,
    email: auth.user.email,
    role: (auth.user as { role?: unknown }).role,
    activeOrganizationId: auth.session.activeOrganizationId ?? null,
  };
}

async function guard<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof OrganizationAccessError) {
      throw createError({ statusCode: error.statusCode, statusMessage: error.message });
    }
    throw error;
  }
}

/** Throw 403 unless the already signed-in caller is a member of the Organization. */
export async function assertOrganizationMember(
  auth: AuthenticatedUser,
  organizationId: string,
  access: OrganizationAccess = organizationAccess,
): Promise<OrganizationMembership> {
  return await guard(() => access.requireMember(toOrganizationAccessActor(auth), organizationId));
}

/** Signed in AND a member (any role) of the given Organization. */
export async function requireOrganizationMember(
  event: Event,
  organizationId: string,
  access: OrganizationAccess = organizationAccess,
): Promise<OrganizationContext> {
  const auth = await requireAuth(event);
  const membership = await assertOrganizationMember(auth, organizationId, access);
  return { auth, organizationId, membership };
}

function requireActiveOrganizationId(auth: AuthenticatedUser): string {
  const organizationId = auth.session.activeOrganizationId;
  if (!organizationId) {
    throw createError({ statusCode: 400, statusMessage: "An active organization is required" });
  }
  return organizationId;
}

/** Signed in, with an Active organization the caller is a member of. */
export async function requireActiveOrganization(
  event: Event,
  access: OrganizationAccess = organizationAccess,
): Promise<OrganizationContext> {
  const auth = await requireAuth(event);
  const organizationId = requireActiveOrganizationId(auth);
  const membership = await guard(() =>
    access.requireMember(toOrganizationAccessActor(auth), organizationId),
  );
  return { auth, organizationId, membership };
}

/** Like {@link requireActiveOrganization}, and Organization admin (`admin`+). */
export async function requireOrgAdmin(
  event: Event,
  access: OrganizationAccess = organizationAccess,
): Promise<OrganizationContext> {
  const auth = await requireAuth(event);
  const organizationId = requireActiveOrganizationId(auth);
  const membership = await guard(() =>
    access.requireOrganizationAdmin(toOrganizationAccessActor(auth), organizationId),
  );
  return { auth, organizationId, membership };
}

/**
 * The single Billing manager gate for organization-scoped billing routes
 * (view, list, cancel, checkout, Plan change): App admin, or a member whose
 * Organization role ranks at least the Organization's billing role. 403
 * otherwise, including when no Organization is given.
 */
export async function requireOrganizationBillingManagerAccess(
  auth: AuthenticatedUser,
  organizationId: string | null | undefined,
  access: OrganizationAccess = organizationAccess,
): Promise<void> {
  if (!(await access.canManageBilling(toOrganizationAccessActor(auth), organizationId))) {
    throw createError({ statusCode: 403, statusMessage: "Billing manager access required" });
  }
}
