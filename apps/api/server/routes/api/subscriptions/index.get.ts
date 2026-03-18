/**
 * List user's subscriptions
 * Works with both Polar and Mercado Pago based on PAYMENT_PROVIDER config
 */
import { defineEventHandler, getQuery } from "h3";
import { ensurePaymentProvider } from "@/lib/payments";
import { requireAuth } from "@/server/utils/membership";
import { discoverSubscriptionsFromDb } from "@/server/utils/subscription-discovery";

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

  // DB-assisted fallback: if provider search found nothing,
  // discover via local DB and verify against provider API
  if (subscriptions.length === 0) {
    subscriptions = await discoverSubscriptionsFromDb(auth.user.id, provider);
  }

  return {
    provider: provider.provider,
    subscriptions,
  };
});
