import { hasAuthRole } from "@beztack/auth";
import type { Subscription } from "@/lib/payments/types";
import type { AuthenticatedUser } from "./membership";

type SubscriptionMetadata = {
  userId?: string;
  ownerEmail?: string;
  referenceId?: string;
  organizationId?: string;
};

type SubscriptionMode = "user" | "organization";

function hasAdminRole(role: unknown): boolean {
  // "admin" is not a Beztack App role; ownership by App admin is decided by
  // domain/organization-access (#51). Kept as an exact role match until then.
  return hasAuthRole<string>(role, "admin");
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isSubscriptionOwnedByUser(
  subscription: Subscription,
  auth: AuthenticatedUser,
  subscriptionMode: SubscriptionMode = "user",
): boolean {
  const authRole = (auth as { role?: unknown }).role ?? (auth.user as { role?: unknown }).role;

  if (hasAdminRole(authRole)) {
    return true;
  }

  const metadata = subscription.metadata as SubscriptionMetadata | undefined;

  if (subscriptionMode === "organization") {
    const activeOrganizationId = auth.session.activeOrganizationId;
    if (!activeOrganizationId) {
      return false;
    }

    return (
      metadata?.referenceId === activeOrganizationId ||
      metadata?.organizationId === activeOrganizationId
    );
  }

  if (subscription.customerId === auth.user.id) {
    return true;
  }

  if (
    subscription.customerEmail &&
    normalizeEmail(subscription.customerEmail) === normalizeEmail(auth.user.email)
  ) {
    return true;
  }

  if (!metadata) {
    return false;
  }

  if (metadata.userId === auth.user.id) {
    return true;
  }

  if (
    metadata.ownerEmail &&
    normalizeEmail(metadata.ownerEmail) === normalizeEmail(auth.user.email)
  ) {
    return true;
  }
  return false;
}
