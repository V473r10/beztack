import type { Subscription } from "@/lib/payments/types";
import type { AuthenticatedUser } from "./membership";

type SubscriptionMetadata = {
  userId?: string;
  ownerEmail?: string;
  referenceId?: string;
  organizationId?: string;
};

function hasAdminRole(role: unknown): boolean {
  if (role === "admin") {
    return true;
  }

  if (Array.isArray(role)) {
    return role.includes("admin");
  }

  return false;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isSubscriptionOwnedByUser(
  subscription: Subscription,
  auth: AuthenticatedUser
): boolean {
  console.log("Checking if subscription is owned by user", subscription, auth);
  const authRole =
    (auth as { role?: unknown }).role ?? (auth.user as { role?: unknown }).role;

  if (hasAdminRole(authRole)) {
    return true;
  }

  if (subscription.customerId === auth.user.id) {
    return true;
  }

  if (
    subscription.customerEmail &&
    normalizeEmail(subscription.customerEmail) ===
      normalizeEmail(auth.user.email)
  ) {
    return true;
  }

  const metadata = subscription.metadata as SubscriptionMetadata | undefined;
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

  const activeOrganizationId = auth.session.activeOrganizationId;
  if (!activeOrganizationId) {
    return false;
  }

  return (
    metadata.referenceId === activeOrganizationId ||
    metadata.organizationId === activeOrganizationId
  );
}
