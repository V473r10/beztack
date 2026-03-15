/**
 * Cancel subscription
 * Works with both Polar and Mercado Pago based on PAYMENT_PROVIDER config
 */
import { createError, defineEventHandler, getQuery, getRouterParam } from "h3";
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

  const query = getQuery(event);
  const immediately = query.immediately === "true";

  try {
    const currentSubscription = await provider.getSubscription(subscriptionId);
    if (!currentSubscription) {
      throw createError({
        statusCode: 404,
        message: "Subscription not found",
      });
    }

    if (!isSubscriptionOwnedByUser(currentSubscription, auth)) {
      throw createError({
        statusCode: 403,
        message: "Access denied",
      });
    }

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
    if (
      error &&
      typeof error === "object" &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
    ) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      message:
        error instanceof Error
          ? error.message
          : "Failed to cancel subscription",
    });
  }
});
