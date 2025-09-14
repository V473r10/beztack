import type { Session, User } from "better-auth/types";
import type { EventHandlerRequest, H3Event } from "h3";
import { createError } from "h3";
import { createConfiguredPolarClient } from "./polar";

export type MembershipTier = "free" | "pro" | "enterprise";

export interface MembershipInfo {
  tier: MembershipTier;
  hasActiveSubscription: boolean;
  subscriptionId?: string;
  benefits: string[];
  organizationId?: string;
  expiresAt?: Date;
}

export interface AuthenticatedUser extends User {
  session: Session;
  membership?: MembershipInfo;
}

/**
 * Middleware to require authentication
 */
export async function requireAuth(
  event: H3Event<EventHandlerRequest>
): Promise<AuthenticatedUser> {
  // Import auth lazily to avoid circular dependency
  const { auth } = await import("./auth");

  const session = await auth.api.getSession({
    headers: event.node.req.headers,
  });

  if (!session) {
    throw createError({
      statusCode: 401,
      statusMessage: "Authentication required",
    });
  }

  return session;
}

/**
 * Get user's membership information from Polar
 */
export async function getMembershipInfo(
  userId: string,
  organizationId?: string
): Promise<MembershipInfo> {
  const polarClient = createConfiguredPolarClient();

  if (!polarClient) {
    // Return free tier if Polar is not configured
    return {
      tier: "free",
      hasActiveSubscription: false,
      benefits: [],
    };
  }

  try {
    // Get customer state from Polar
    // This would use the user ID as the external_id for the Polar customer
    const customerState = await polarClient.customers.get({
      id: userId, // or find by external_id
    });

    if (!customerState) {
      return {
        tier: "free",
        hasActiveSubscription: false,
        benefits: [],
      };
    }

    // Check for active subscriptions
    const activeSubscriptions =
      customerState.subscriptions?.filter(
        (sub) =>
          sub.status === "active" &&
          (!organizationId || sub.metadata?.referenceId === organizationId)
      ) || [];

    const hasActiveSubscription = activeSubscriptions.length > 0;

    // Determine membership tier based on active subscriptions
    let tier: MembershipTier = "free";
    let subscriptionId: string | undefined;
    let expiresAt: Date | undefined;

    if (hasActiveSubscription) {
      const subscription = activeSubscriptions[0]; // Use first active subscription
      subscriptionId = subscription.id;

      // Determine tier based on product or subscription metadata
      // This logic should match your actual product setup in Polar
      if (subscription.product?.name?.toLowerCase().includes("enterprise")) {
        tier = "enterprise";
      } else if (subscription.product?.name?.toLowerCase().includes("pro")) {
        tier = "pro";
      }

      if (subscription.current_period_end) {
        expiresAt = new Date(subscription.current_period_end);
      }
    }

    // Extract benefits from Polar customer state
    const benefits =
      customerState.benefits?.map((benefit) => benefit.type) || [];

    return {
      tier,
      hasActiveSubscription,
      subscriptionId,
      benefits,
      organizationId,
      expiresAt,
    };
  } catch (error) {
    console.error("Error fetching membership info:", error);

    // Return free tier on error to be safe
    return {
      tier: "free",
      hasActiveSubscription: false,
      benefits: [],
    };
  }
}

/**
 * Middleware to require specific membership tier
 */
export async function requireMembership(
  event: H3Event<EventHandlerRequest>,
  requiredTier: MembershipTier
): Promise<AuthenticatedUser> {
  const user = await requireAuth(event);

  // Get organization context if available from session
  const organizationId = user.session.activeOrganizationId;

  const membership = await getMembershipInfo(user.user.id, organizationId);

  // Check if user meets the required tier
  if (!hasAccessToTier(membership.tier, requiredTier)) {
    throw createError({
      statusCode: 403,
      statusMessage: `${requiredTier} membership required`,
    });
  }

  return {
    ...user,
    membership,
  };
}

/**
 * Check if a user's tier provides access to a required tier
 */
export function hasAccessToTier(
  userTier: MembershipTier,
  requiredTier: MembershipTier
): boolean {
  const tierHierarchy: Record<MembershipTier, number> = {
    free: 0,
    pro: 1,
    enterprise: 2,
  };

  return tierHierarchy[userTier] >= tierHierarchy[requiredTier];
}

/**
 * Middleware factory for specific tiers
 */
export const requirePro = (event: H3Event<EventHandlerRequest>) =>
  requireMembership(event, "pro");

export const requireEnterprise = (event: H3Event<EventHandlerRequest>) =>
  requireMembership(event, "enterprise");

/**
 * Check if user has specific benefit
 */
export function hasBenefit(
  membership: MembershipInfo,
  benefitType: string
): boolean {
  return membership.benefits.includes(benefitType);
}

/**
 * Middleware to require specific benefit
 */
export async function requireBenefit(
  event: H3Event<EventHandlerRequest>,
  benefitType: string
): Promise<AuthenticatedUser> {
  const user = await requireAuth(event);
  const organizationId = user.session.activeOrganizationId;
  const membership = await getMembershipInfo(user.user.id, organizationId);

  if (!hasBenefit(membership, benefitType)) {
    throw createError({
      statusCode: 403,
      statusMessage: `Required benefit: ${benefitType}`,
    });
  }

  return {
    ...user,
    membership,
  };
}

/**
 * Get membership status for a user (utility function for API responses)
 */
export async function getUserMembershipStatus(
  userId: string,
  organizationId?: string
) {
  const membership = await getMembershipInfo(userId, organizationId);

  return {
    tier: membership.tier,
    hasActiveSubscription: membership.hasActiveSubscription,
    benefits: membership.benefits,
    expiresAt: membership.expiresAt?.toISOString(),
    organizationId,
  };
}
