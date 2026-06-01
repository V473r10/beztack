/**
 * List user's subscriptions
 * Works with both Polar and Mercado Pago based on PAYMENT_PROVIDER config
 */
import { defineEventHandler, getQuery } from "h3";
import { env } from "@/env";
import { ensurePaymentProvider } from "@/lib/payments";
import { requireAuth } from "@/server/utils/membership";
import { discoverSubscriptionsFromDb } from "@/server/utils/subscription-discovery";
import { isSubscriptionOwnedByUser } from "@/server/utils/subscription-ownership";

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);
  const provider = await ensurePaymentProvider();

  const query = getQuery(event);
  const limit = query.limit ? Number(query.limit) : undefined;
  const offset = query.offset ? Number(query.offset) : undefined;

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
    isSubscriptionOwnedByUser(subscription, auth, env.SUBSCRIPTION_MODE)
  );

  return {
    provider: provider.provider,
    subscriptions,
  };
});
