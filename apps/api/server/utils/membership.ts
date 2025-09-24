import { Polar } from "@polar-sh/sdk";
import type { Benefit } from "@polar-sh/sdk/models/components/benefit.js";
import type { Customer } from "@polar-sh/sdk/models/components/customer.js";
import type { Session, User } from "better-auth/types";
import type { EventHandlerRequest, H3Event } from "h3";
import { createError } from "h3";

export type MembershipTier = "free" | "pro" | "enterprise";

export type MembershipInfo = {
  tier: MembershipTier;
  hasActiveSubscription: boolean;
  subscriptionId?: string;
  benefits: Benefit[];
  organizationId?: string;
  expiresAt?: Date;
};

// Extend Session type to include organization plugin fields
type ExtendedSession = Session & {
  activeOrganizationId?: string | null;
  activeTeamId?: string | null;
};

export interface AuthenticatedUser {
  // User properties (flattened from User type)
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Additional properties
  session: ExtendedSession;
  membership?: MembershipInfo;
  // Keep user object for backward compatibility
  user: User;
}

/**
 * Middleware to require authentication
 */
export async function requireAuth(
  event: H3Event<EventHandlerRequest>
): Promise<AuthenticatedUser> {
  // Import auth lazily to avoid circular dependency
  const { auth } = await import("./auth");

  // Convert Node.js IncomingHttpHeaders to Web API Headers
  const headers = new Headers();
  for (const [key, value] of Object.entries(event.node.req.headers)) {
    if (value) {
      // Handle both string and string[] values
      const headerValue = Array.isArray(value) ? value.join(", ") : value;
      headers.set(key, headerValue);
    }
  }

  const session = await auth.api.getSession({
    headers,
  });

  if (!session) {
    throw createError({
      statusCode: 401,
      statusMessage: "Authentication required",
    });
  }

  // Structure the response to match AuthenticatedUser interface
  // The session object contains both user and session data
  return {
    ...session.user,
    session: session.session as ExtendedSession,
    user: session.user,
  };
}

/**
 * Get user's membership information from Polar
 */
export async function getMembershipInfo(
  userId: string,
  organizationId?: string
): Promise<MembershipInfo> {
  const polar = new Polar({
    accessToken: process.env.POLAR_ACCESS_TOKEN,
    server: process.env.POLAR_SERVER as "production" | "sandbox",
  });

  if (!polar) {
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
    const customer: Customer = await polar.customers.get({
      id: userId, // or find by external_id
    });

    if (!customer) {
      return {
        tier: "free",
        hasActiveSubscription: false,
        benefits: [],
      };
    }

    const subscriptions = await polar.subscriptions.list({
      organizationId,
      customerId: customer.id,
    });

    // Check for active subscriptions
    const activeSubscriptions =
      subscriptions.result.items.filter(
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

      if (subscription.currentPeriodEnd) {
        expiresAt = new Date(subscription.currentPeriodEnd);
      }
    }

    const productsSubscribedTo = subscriptions.result.items.map(
      (sub) => sub.product
    );

    // Extract benefits from Polar customer state
    const benefits: Benefit[] = productsSubscribedTo.flatMap(
      (product) => product?.benefits || []
    );

    return {
      tier,
      hasActiveSubscription,
      subscriptionId,
      benefits,
      organizationId,
      expiresAt,
    };
  } catch (_error) {
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

  const membership = await getMembershipInfo(
    user.user.id,
    organizationId || undefined
  );

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
  return membership.benefits.some((benefit) => benefit.type === benefitType);
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
  const membership = await getMembershipInfo(
    user.user.id,
    organizationId || undefined
  );

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
