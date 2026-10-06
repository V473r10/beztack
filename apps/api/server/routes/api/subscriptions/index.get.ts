/**
 * List user's subscriptions
 * Works with both Polar and Mercado Pago based on PAYMENT_PROVIDER config
 */
import { defineEventHandler, getQuery } from "h3";
import { env } from "@/env";
import { ensurePaymentProvider } from "@/lib/payments";
import { organizationAccess } from "@/server/domain/organization-access";
import { type AuthenticatedUser, requireAuth } from "@/server/utils/membership";
import {
  requireOrganizationBillingManagerAccess,
  toOrganizationAccessActor,
} from "@/server/utils/organization-access";
import { discoverSubscriptionsFromDb } from "@/server/utils/subscription-discovery";

function readQueryString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function withSubscriptionOrganization(
  auth: AuthenticatedUser,
  organizationId: string | undefined,
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
      ? (requestedOrganizationId ?? auth.session.activeOrganizationId ?? undefined)
      : undefined;

  // The Subscription list is billing data: hidden from members who are not
  // Billing managers. Without any Organization there is nothing to list.
  if (env.SUBSCRIPTION_MODE === "organization" && organizationId) {
    await requireOrganizationBillingManagerAccess(auth, organizationId);
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
    organizationAccess.ownsSubscription(
      toOrganizationAccessActor(scopedAuth),
      subscription,
      env.SUBSCRIPTION_MODE,
    ),
  );

  return {
    provider: provider.provider,
    subscriptions,
  };
});
