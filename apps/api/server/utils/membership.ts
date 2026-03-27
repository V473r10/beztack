import { db, organization as orgTable, user as userTable } from "@beztack/db";
import type { Session, User } from "better-auth/types";
import { eq } from "drizzle-orm";
import type { EventHandlerRequest, H3Event } from "h3";
import { createError } from "h3";
import { env } from "@/env";
import { ensurePaymentProvider } from "@/lib/payments";
import type { Subscription } from "@/lib/payments/types";
import { discoverSubscriptionsFromDb } from "./subscription-discovery";

export type Benefit = {
  type: string;
  details?: Record<string, unknown>;
};

export type MembershipTier =
  | "free"
  | "basic"
  | "pro"
  | "ultimate"
  | "enterprise";

export type MembershipInfo = {
  tier: MembershipTier;
  hasActiveSubscription: boolean;
  subscriptionId?: string;
  benefits: Benefit[];
  organizationId?: string;
  expiresAt?: Date;
};

type ExtendedSession = Session & {
  activeOrganizationId?: string | null;
  activeTeamId?: string | null;
};

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  createdAt: Date;
  updatedAt: Date;
  session: ExtendedSession;
  membership?: MembershipInfo;
  user: User;
}

function mapTier(value: string | undefined): MembershipTier {
  const normalized = value?.trim().toLowerCase() ?? "";

  if (normalized.includes("enterprise") || normalized.includes("ultimate")) {
    return "ultimate";
  }

  if (normalized.includes("pro")) {
    return "pro";
  }

  if (normalized.includes("basic")) {
    return "basic";
  }

  return "free";
}

function isSubscriptionStatusActive(
  status: string | null,
  validUntil: Date | null
): boolean {
  if (status === "active") {
    return true;
  }
  if (status === "canceled" && validUntil && validUntil > new Date()) {
    return true;
  }
  return false;
}

function isSubscriptionActive(subscription: Subscription): boolean {
  if (subscription.status === "active") {
    return true;
  }

  if (
    subscription.status === "canceled" &&
    subscription.currentPeriodEnd &&
    subscription.currentPeriodEnd > new Date()
  ) {
    return true;
  }

  return false;
}

function belongsToOrganization(
  subscription: Subscription,
  organizationId?: string
): boolean {
  if (!organizationId) {
    return true;
  }

  const metadata = subscription.metadata as
    | {
        organizationId?: string;
        referenceId?: string;
      }
    | undefined;

  return (
    metadata?.organizationId === organizationId ||
    metadata?.referenceId === organizationId
  );
}

function getBenefits(subscription: Subscription): Benefit[] {
  const metadata = subscription.metadata as
    | {
        features?: unknown;
      }
    | undefined;

  if (!Array.isArray(metadata?.features)) {
    return [];
  }

  return metadata.features
    .filter((feature): feature is string => typeof feature === "string")
    .map((feature) => ({
      type: feature,
    }));
}

function getTierFromSubscription(subscription: Subscription): MembershipTier {
  const metadata = subscription.metadata as
    | {
        tier?: string;
      }
    | undefined;

  return mapTier(metadata?.tier ?? subscription.productName);
}

export async function requireAuth(
  event: H3Event<EventHandlerRequest>
): Promise<AuthenticatedUser> {
  const { auth } = await import("./auth");

  const headers = new Headers();
  for (const [key, value] of Object.entries(event.node.req.headers)) {
    if (!value) {
      continue;
    }
    headers.set(key, Array.isArray(value) ? value.join(", ") : value);
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

  return {
    ...session.user,
    session: session.session as ExtendedSession,
    user: session.user,
  };
}

/**
 * DB-first membership resolution.
 * Reads denormalized subscription data from the entity (user or org).
 * Falls back to provider API if no local data is available.
 */
export async function getMembershipInfo(
  userId: string,
  organizationId?: string
): Promise<MembershipInfo> {
  const isOrgMode = env.SUBSCRIPTION_MODE === "organization";

  // DB-first: try reading cached subscription data from the entity
  if (isOrgMode && organizationId) {
    const [org] = await db
      .select({
        subscriptionTier: orgTable.subscriptionTier,
        subscriptionStatus: orgTable.subscriptionStatus,
        subscriptionId: orgTable.subscriptionId,
        subscriptionValidUntil: orgTable.subscriptionValidUntil,
      })
      .from(orgTable)
      .where(eq(orgTable.id, organizationId))
      .limit(1);

    if (org?.subscriptionTier) {
      const isActive = isSubscriptionStatusActive(
        org.subscriptionStatus,
        org.subscriptionValidUntil
      );
      return {
        tier: mapTier(org.subscriptionTier),
        hasActiveSubscription: isActive,
        subscriptionId: org.subscriptionId ?? undefined,
        benefits: [],
        organizationId,
        expiresAt: org.subscriptionValidUntil ?? undefined,
      };
    }
  }

  if (!isOrgMode) {
    const [dbUser] = await db
      .select({
        subscriptionTier: userTable.subscriptionTier,
        subscriptionStatus: userTable.subscriptionStatus,
        subscriptionId: userTable.subscriptionId,
        subscriptionValidUntil: userTable.subscriptionValidUntil,
        email: userTable.email,
      })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);

    if (dbUser?.subscriptionTier) {
      const isActive = isSubscriptionStatusActive(
        dbUser.subscriptionStatus,
        dbUser.subscriptionValidUntil
      );
      return {
        tier: mapTier(dbUser.subscriptionTier),
        hasActiveSubscription: isActive,
        subscriptionId: dbUser.subscriptionId ?? undefined,
        benefits: [],
        expiresAt: dbUser.subscriptionValidUntil ?? undefined,
      };
    }
  }

  // Fallback: query payment provider API
  return getMembershipInfoFromProvider(userId, organizationId);
}

async function getMembershipInfoFromProvider(
  userId: string,
  organizationId?: string
): Promise<MembershipInfo> {
  const [dbUser] = await db
    .select({ email: userTable.email })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);

  if (!dbUser?.email) {
    return {
      tier: "free",
      hasActiveSubscription: false,
      benefits: [],
    };
  }

  try {
    const provider = await ensurePaymentProvider();
    let subscriptions = await provider.listSubscriptions({
      customerEmail: dbUser.email,
      limit: 100,
    });

    // DB-assisted fallback: if provider search found nothing,
    // discover via local DB and verify against provider API
    if (subscriptions.length === 0) {
      subscriptions = await discoverSubscriptionsFromDb(userId, provider);
    }

    const scopedSubscriptions = subscriptions.filter((subscription) =>
      belongsToOrganization(subscription, organizationId)
    );

    const activeSubscriptions =
      scopedSubscriptions.filter(isSubscriptionActive);

    if (activeSubscriptions.length === 0) {
      return {
        tier: "free",
        hasActiveSubscription: false,
        benefits: [],
        organizationId,
      };
    }

    const selectedSubscription = activeSubscriptions
      .slice()
      .sort((left, right) => {
        const leftTs = left.currentPeriodEnd?.getTime() ?? 0;
        const rightTs = right.currentPeriodEnd?.getTime() ?? 0;
        return rightTs - leftTs;
      })[0];

    return {
      tier: getTierFromSubscription(selectedSubscription),
      hasActiveSubscription: true,
      subscriptionId: selectedSubscription.id,
      benefits: getBenefits(selectedSubscription),
      organizationId,
      expiresAt: selectedSubscription.currentPeriodEnd,
    };
  } catch {
    return {
      tier: "free",
      hasActiveSubscription: false,
      benefits: [],
      organizationId,
    };
  }
}

export async function requireMembership(
  event: H3Event<EventHandlerRequest>,
  requiredTier: MembershipTier
): Promise<AuthenticatedUser> {
  const authenticatedUser = await requireAuth(event);
  const organizationId = authenticatedUser.session.activeOrganizationId;

  const membership = await getMembershipInfo(
    authenticatedUser.user.id,
    organizationId || undefined
  );

  if (!hasAccessToTier(membership.tier, requiredTier)) {
    throw createError({
      statusCode: 403,
      statusMessage: `${requiredTier} membership required`,
    });
  }

  return {
    ...authenticatedUser,
    membership,
  };
}

export function hasAccessToTier(
  userTier: MembershipTier,
  requiredTier: MembershipTier
): boolean {
  const tierHierarchy: Record<MembershipTier, number> = {
    free: 0,
    basic: 1,
    pro: 2,
    ultimate: 3,
    enterprise: 3,
  };

  return tierHierarchy[userTier] >= tierHierarchy[requiredTier];
}

export const requirePro = (event: H3Event<EventHandlerRequest>) =>
  requireMembership(event, "pro");

export const requireEnterprise = (event: H3Event<EventHandlerRequest>) =>
  requireMembership(event, "ultimate");

export function hasBenefit(
  membership: MembershipInfo,
  benefitType: string
): boolean {
  return membership.benefits.some((benefit) => benefit.type === benefitType);
}

export async function requireBenefit(
  event: H3Event<EventHandlerRequest>,
  benefitType: string
): Promise<AuthenticatedUser> {
  const authenticatedUser = await requireAuth(event);
  const organizationId = authenticatedUser.session.activeOrganizationId;
  const membership = await getMembershipInfo(
    authenticatedUser.user.id,
    organizationId || undefined
  );

  if (!hasBenefit(membership, benefitType)) {
    throw createError({
      statusCode: 403,
      statusMessage: `Required benefit: ${benefitType}`,
    });
  }

  return {
    ...authenticatedUser,
    membership,
  };
}

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
