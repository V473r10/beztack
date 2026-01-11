/**
 * Cancel subscription
 * Works with both Polar and Mercado Pago based on PAYMENT_PROVIDER config
 */
import { createError, defineEventHandler, getQuery, getRouterParam } from "h3";
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

  const query = getQuery(event);
  const immediately = query.immediately === "true";

  try {
    const subscription = await provider.cancelSubscription(
      subscriptionId,
      immediately
    );

    return {
      provider: provider.provider,
      subscription,
      message: immediately
        ? "Subscription canceled immediately"
        : "Subscription will be canceled at the end of the billing period",
    };
  } catch (error) {
    throw createError({
      statusCode: 500,
      message:
        error instanceof Error
          ? error.message
          : "Failed to cancel subscription",
    });
  }
});
