/**
 * Get subscription by ID
 * Works with both Polar and Mercado Pago based on PAYMENT_PROVIDER config
 */
import { createError, defineEventHandler, getRouterParam } from "h3";
import { ensurePaymentProvider } from "@/lib/payments";
import { requireAuth } from "@/server/utils/membership";
import { isSubscriptionOwnedByUser } from "@/server/utils/subscription-ownership";

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);
  const provider = await ensurePaymentProvider();

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

  if (!isSubscriptionOwnedByUser(subscription, auth)) {
    throw createError({
      statusCode: 403,
      message: "Access denied",
    });
  }

  return {
    provider: provider.provider,
    subscription,
  };
});
