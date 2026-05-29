/**
 * Mercado Pago compatibility webhook Adapter.
 * Kept for existing provider configuration while delegating to Subscription projection.
 */

import {
  createMercadoPagoClient,
  type WebhookPayload,
} from "@beztack/mercadopago/server";
import { createError, defineEventHandler, getHeader, readBody } from "h3";
import { env } from "@/env";
import {
  createMercadoPagoProjectionEventEnvelope,
  getDefaultSubscriptionProjectionDependencies,
  projectSubscriptionProviderEvent,
} from "@/server/utils/subscription-projection";

const mp = createMercadoPagoClient({
  accessToken: env.MERCADO_PAGO_ACCESS_TOKEN,
  webhookSecret: env.MERCADO_PAGO_WEBHOOK_SECRET,
  integratorId: env.MERCADO_PAGO_INTEGRATOR_ID,
});

export default defineEventHandler(async (event) => {
  const body = await readBody<WebhookPayload>(event);
  const xSignature = getHeader(event, "x-signature");
  const xRequestId = getHeader(event, "x-request-id");

  if (
    !mp.webhooks.validate(xSignature ?? null, xRequestId ?? null, body.data.id)
  ) {
    return { success: false, error: "Invalid signature" };
  }

  const envelope = createMercadoPagoProjectionEventEnvelope(body, xRequestId);
  const dependencies = await getDefaultSubscriptionProjectionDependencies();
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
    received: body.id,
    outcome: outcome.status,
    warnings: outcome.warnings,
    touched: outcome.touched,
  };
});
