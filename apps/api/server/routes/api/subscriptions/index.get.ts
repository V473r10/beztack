/**
 * List user's subscriptions
 * Works with both Polar and Mercado Pago based on PAYMENT_PROVIDER config
 */
import { db, member as memberTable } from "@beztack/db";
import { and, eq } from "drizzle-orm";
import { createError, defineEventHandler, getQuery } from "h3";
import { env } from "@/env";
import { ensurePaymentProvider } from "@/lib/payments";
import { type AuthenticatedUser, requireAuth } from "@/server/utils/membership";
import { discoverSubscriptionsFromDb } from "@/server/utils/subscription-discovery";
import { isSubscriptionOwnedByUser } from "@/server/utils/subscription-ownership";

function readQueryString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

async function assertOrganizationMember(
  userId: string,
  organizationId: string
): Promise<void> {
  const [membership] = await db
    .select({ id: memberTable.id })
    .from(memberTable)
    .where(
      and(
        eq(memberTable.userId, userId),
        eq(memberTable.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!membership) {
    throw createError({
      statusCode: 403,
      statusMessage: "Access denied: You are not a member of this organization",
    });
  }
}

function withSubscriptionOrganization(
  auth: AuthenticatedUser,
  organizationId: string | undefined
): AuthenticatedUser {
  if (!(env.SUBSCRIPTION_MODE === "organization" && organizationId)) {
    return auth;
  }

  return {
    ...auth,
    session: {
      ...auth.session,
      activeOrganizationId: organizationId,
    },
  };
}

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);
  const provider = await ensurePaymentProvider();

  const query = getQuery(event);
  const limit = query.limit ? Number(query.limit) : undefined;
  const offset = query.offset ? Number(query.offset) : undefined;
  const requestedOrganizationId = readQueryString(query.organizationId);
  const organizationId =
    env.SUBSCRIPTION_MODE === "organization"
      ? (requestedOrganizationId ??
        auth.session.activeOrganizationId ??
        undefined)
      : undefined;

  if (env.SUBSCRIPTION_MODE === "organization" && requestedOrganizationId) {
    await assertOrganizationMember(auth.user.id, requestedOrganizationId);
  }
  const scopedAuth = withSubscriptionOrganization(auth, organizationId);

  let subscriptions = await provider.listSubscriptions({
    customerEmail: auth.user.email,
    customerId: auth.user.id,
    limit,
    offset,
  });

  if (subscriptions.length === 0) {
    subscriptions = await discoverSubscriptionsFromDb(auth.user.id, provider);
  } else {
    // Merge DB-discovered subscriptions (e.g. cancelled but still within
    // their billing period) that the provider search missed.
    const dbSubs = await discoverSubscriptionsFromDb(auth.user.id, provider);
    const existingIds = new Set(subscriptions.map((s) => s.id));
    for (const dbSub of dbSubs) {
      if (!existingIds.has(dbSub.id)) {
        subscriptions.push(dbSub);
      }
    }
  }

  subscriptions = subscriptions.filter((subscription) =>
    isSubscriptionOwnedByUser(subscription, scopedAuth, env.SUBSCRIPTION_MODE)
  );

  return {
    provider: provider.provider,
    subscriptions,
  };
});
