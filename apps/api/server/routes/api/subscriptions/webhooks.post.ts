/**
 * Canonical Subscription projection webhook Adapter.
 * Routes validate transport, then delegate provider events to the projection Module.
 */

import { createError, defineEventHandler, getHeader, readRawBody } from "h3";
import { ensurePaymentProvider } from "@/lib/payments";
import {
  createProjectionEventEnvelopeFromWebhookPayload,
  getDefaultSubscriptionProjectionDependencies,
  projectSubscriptionProviderEvent,
} from "@/server/utils/subscription-projection";

export default defineEventHandler(async (event) => {
  const provider = await ensurePaymentProvider();
  const rawBody = await readRawBody(event);

  if (!rawBody) {
    throw createError({
      statusCode: 400,
      message: "Missing request body",
    });
  }

  const signature =
    getHeader(event, "x-signature") ??
    getHeader(event, "x-polar-signature") ??
    "";
  const deliveryId = getHeader(event, "x-request-id");
  const payload = await provider.parseWebhook(rawBody, signature);
  const envelope = createProjectionEventEnvelopeFromWebhookPayload({
    provider: provider.provider,
    eventType: payload.type,
    rawPayload: payload.rawPayload,
    deliveryId,
    subscriptionId: payload.subscription?.id,
  });
  const dependencies =
    await getDefaultSubscriptionProjectionDependencies(provider);
  const outcome = await projectSubscriptionProviderEvent(
    envelope,
    dependencies
  );

  if (outcome.status === "failed") {
    throw createError({
      statusCode: 500,
      message: outcome.error ?? "Webhook processing failed",
    });
  }

  return {
    success: true,
    provider: outcome.provider,
    eventType: outcome.eventType,
    outcome: outcome.status,
    warnings: outcome.warnings,
    touched: outcome.touched,
  };
});
