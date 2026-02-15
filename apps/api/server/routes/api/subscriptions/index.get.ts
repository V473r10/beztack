/**
 * List user's subscriptions
 * Works with both Polar and Mercado Pago based on PAYMENT_PROVIDER config
 */
import { defineEventHandler, getQuery } from "h3";
import { getPaymentProvider } from "@/lib/payments";
import { requireAuth } from "@/server/utils/membership";

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event);
  const provider = getPaymentProvider();

  const query = getQuery(event);
  const limit = query.limit ? Number(query.limit) : undefined;
  const offset = query.offset ? Number(query.offset) : undefined;

  const subscriptions = await provider.listSubscriptions({
    customerEmail: user.email,
    limit,
    offset,
  });

  return {
    provider: provider.provider,
    subscriptions,
  };
});
