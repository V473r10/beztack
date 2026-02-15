/**
 * Get subscription by ID
 * Works with both Polar and Mercado Pago based on PAYMENT_PROVIDER config
 */
import { createError, defineEventHandler, getRouterParam } from "h3";
import { getPaymentProvider } from "@/lib/payments";
import { requireAuth } from "@/server/utils/membership";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const provider = getPaymentProvider();

  const subscriptionId = getRouterParam(event, "id");
  if (!subscriptionId) {
    throw createError({
      statusCode: 400,
      message: "Subscription ID is required",
    });
  }

  const subscription = await provider.getSubscription(subscriptionId);

  if (!subscription) {
    throw createError({
      statusCode: 404,
      message: "Subscription not found",
    });
  }

  return {
    provider: provider.provider,
    subscription,
  };
});
