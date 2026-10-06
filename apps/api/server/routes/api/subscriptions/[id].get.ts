/**
 * Get subscription by ID
 * Works with both Polar and Mercado Pago based on PAYMENT_PROVIDER config
 */
import { createError, defineEventHandler, getRouterParam } from "h3";
import { env } from "@/env";
import { ensurePaymentProvider } from "@/lib/payments";
import { requireAuth } from "@/server/utils/membership";
import { organizationAccess } from "@/server/domain/organization-access";
import {
  requireOrganizationBillingManagerAccess,
  toOrganizationAccessActor,
} from "@/server/utils/organization-access";

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);
  // Organization billing: only Billing managers (and App admins) may view or
  // manage the organization's Subscriptions.
  if (env.SUBSCRIPTION_MODE === "organization") {
    await requireOrganizationBillingManagerAccess(auth, auth.session.activeOrganizationId);
  }
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

  if (
    !organizationAccess.ownsSubscription(
      toOrganizationAccessActor(auth),
      subscription,
      env.SUBSCRIPTION_MODE,
    )
  ) {
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
