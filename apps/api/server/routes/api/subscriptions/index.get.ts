/**
 * List user's subscriptions
 * Works with both Polar and Mercado Pago based on PAYMENT_PROVIDER config
 */
import { defineEventHandler, getQuery } from "h3";
import { ensurePaymentProvider } from "@/lib/payments";
import { requireAuth } from "@/server/utils/membership";
import { isSubscriptionOwnedByUser } from "@/server/utils/subscription-ownership";

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);
  const provider = await ensurePaymentProvider();

  const query = getQuery(event);
  const limit = query.limit ? Number(query.limit) : undefined;
  const offset = query.offset ? Number(query.offset) : undefined;

  const subscriptions = await provider.listSubscriptions({
    customerEmail: auth.user.email,
    limit,
    offset,
  });

  const ownedSubscriptions = subscriptions.filter((subscription) =>
    isSubscriptionOwnedByUser(subscription, auth)
  );

  return {
    provider: provider.provider,
    subscriptions: ownedSubscriptions,
  };
});
