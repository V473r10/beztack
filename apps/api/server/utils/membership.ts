import { eq } from "drizzle-orm"
import type { Session, User } from "better-auth/types"
import type { EventHandlerRequest, H3Event } from "h3"
import { createError } from "h3"
import { db, user as userTable } from "@beztack/db"
import { getPaymentProvider } from "@/lib/payments"
import type { Subscription } from "@/lib/payments/types"

export type Benefit = {
  type: string
  details?: Record<string, unknown>
}

export type MembershipTier = "free" | "pro" | "enterprise"

export type MembershipInfo = {
  tier: MembershipTier
  hasActiveSubscription: boolean
  subscriptionId?: string
  benefits: Benefit[]
  organizationId?: string
  expiresAt?: Date
}

type ExtendedSession = Session & {
  activeOrganizationId?: string | null
  activeTeamId?: string | null
}

export interface AuthenticatedUser {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image?: string | null
  createdAt: Date
  updatedAt: Date
  session: ExtendedSession
  membership?: MembershipInfo
  user: User
}

function mapTier(value: string | undefined): MembershipTier {
  const normalized = value?.trim().toLowerCase() ?? ""

  if (normalized.includes("enterprise") || normalized.includes("ultimate")) {
    return "enterprise"
  }

  if (normalized.includes("pro")) {
    return "pro"
  }

  return "free"
}

function isSubscriptionActive(subscription: Subscription): boolean {
  if (subscription.status === "active") {
    return true
  }

  if (
    subscription.status === "canceled" &&
    subscription.currentPeriodEnd &&
    subscription.currentPeriodEnd > new Date()
  ) {
    return true
  }

  return false
}

function belongsToOrganization(
  subscription: Subscription,
  organizationId?: string
): boolean {
  if (!organizationId) {
    return true
  }

  const metadata = subscription.metadata as
    | {
        organizationId?: string
        referenceId?: string
      }
    | undefined

  return (
    metadata?.organizationId === organizationId ||
    metadata?.referenceId === organizationId
  )
}

function getBenefits(subscription: Subscription): Benefit[] {
  const metadata = subscription.metadata as
    | {
        features?: unknown
      }
    | undefined

  if (!Array.isArray(metadata?.features)) {
    return []
  }

  return metadata.features
    .filter((feature): feature is string => typeof feature === "string")
    .map((feature) => ({
      type: feature,
    }))
}

function getTierFromSubscription(subscription: Subscription): MembershipTier {
  const metadata = subscription.metadata as
    | {
        tier?: string
      }
    | undefined

  return mapTier(metadata?.tier ?? subscription.productName)
}

export async function requireAuth(
  event: H3Event<EventHandlerRequest>
): Promise<AuthenticatedUser> {
  const { auth } = await import("./auth")

  const headers = new Headers()
  for (const [key, value] of Object.entries(event.node.req.headers)) {
    if (!value) {
      continue
    }
    headers.set(key, Array.isArray(value) ? value.join(", ") : value)
  }

  const session = await auth.api.getSession({
    headers,
  })

  if (!session) {
    throw createError({
      statusCode: 401,
      statusMessage: "Authentication required",
    })
  }

  return {
    ...session.user,
    session: session.session as ExtendedSession,
    user: session.user,
  }
}

export async function getMembershipInfo(
  userId: string,
  organizationId?: string
): Promise<MembershipInfo> {
  const [dbUser] = await db
    .select({
      email: userTable.email,
    })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1)

  if (!dbUser?.email) {
    return {
      tier: "free",
      hasActiveSubscription: false,
      benefits: [],
    }
  }

  try {
    const provider = getPaymentProvider()
    const subscriptions = await provider.listSubscriptions({
      customerEmail: dbUser.email,
      limit: 100,
    })

    const scopedSubscriptions = subscriptions.filter((subscription) =>
      belongsToOrganization(subscription, organizationId)
    )

    const activeSubscriptions = scopedSubscriptions.filter(
      isSubscriptionActive
    )

    if (activeSubscriptions.length === 0) {
      return {
        tier: "free",
        hasActiveSubscription: false,
        benefits: [],
        organizationId,
      }
    }

    const selectedSubscription = activeSubscriptions
      .slice()
      .sort((left, right) => {
        const leftTs = left.currentPeriodEnd?.getTime() ?? 0
        const rightTs = right.currentPeriodEnd?.getTime() ?? 0
        return rightTs - leftTs
      })[0]

    return {
      tier: getTierFromSubscription(selectedSubscription),
      hasActiveSubscription: true,
      subscriptionId: selectedSubscription.id,
      benefits: getBenefits(selectedSubscription),
      organizationId,
      expiresAt: selectedSubscription.currentPeriodEnd,
    }
  } catch {
    return {
      tier: "free",
      hasActiveSubscription: false,
      benefits: [],
      organizationId,
    }
  }
}

export async function requireMembership(
  event: H3Event<EventHandlerRequest>,
  requiredTier: MembershipTier
): Promise<AuthenticatedUser> {
  const user = await requireAuth(event)
  const organizationId = user.session.activeOrganizationId

  const membership = await getMembershipInfo(
    user.user.id,
    organizationId || undefined
  )

  if (!hasAccessToTier(membership.tier, requiredTier)) {
    throw createError({
      statusCode: 403,
      statusMessage: `${requiredTier} membership required`,
    })
  }

  return {
    ...user,
    membership,
  }
}

export function hasAccessToTier(
  userTier: MembershipTier,
  requiredTier: MembershipTier
): boolean {
  const tierHierarchy: Record<MembershipTier, number> = {
    free: 0,
    pro: 1,
    enterprise: 2,
  }

  return tierHierarchy[userTier] >= tierHierarchy[requiredTier]
}

export const requirePro = (event: H3Event<EventHandlerRequest>) =>
  requireMembership(event, "pro")

export const requireEnterprise = (event: H3Event<EventHandlerRequest>) =>
  requireMembership(event, "enterprise")

export function hasBenefit(
  membership: MembershipInfo,
  benefitType: string
): boolean {
  return membership.benefits.some((benefit) => benefit.type === benefitType)
}

export async function requireBenefit(
  event: H3Event<EventHandlerRequest>,
  benefitType: string
): Promise<AuthenticatedUser> {
  const user = await requireAuth(event)
  const organizationId = user.session.activeOrganizationId
  const membership = await getMembershipInfo(
    user.user.id,
    organizationId || undefined
  )

  if (!hasBenefit(membership, benefitType)) {
    throw createError({
      statusCode: 403,
      statusMessage: `Required benefit: ${benefitType}`,
    })
  }

  return {
    ...user,
    membership,
  }
}

export async function getUserMembershipStatus(
  userId: string,
  organizationId?: string
) {
  const membership = await getMembershipInfo(userId, organizationId)

  return {
    tier: membership.tier,
    hasActiveSubscription: membership.hasActiveSubscription,
    benefits: membership.benefits,
    expiresAt: membership.expiresAt?.toISOString(),
    organizationId,
  }
}
