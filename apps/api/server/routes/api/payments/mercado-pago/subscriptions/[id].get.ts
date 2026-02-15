import { createMercadoPagoClient } from "@beztack/mercadopago/server";
import { createError, defineEventHandler, getRouterParam } from "h3";
import { env } from "@/env";

const mp = createMercadoPagoClient({
  accessToken: env.MERCADO_PAGO_ACCESS_TOKEN,
  integratorId: env.MERCADO_PAGO_INTEGRATOR_ID,
});

export default defineEventHandler(async (event) => {
  const subscriptionId = getRouterParam(event, "id");

  if (!subscriptionId) {
    throw createError({
      statusCode: 400,
      message: "Subscription ID is required",
    });
  }

  const subscription = await mp.subscriptions.get(subscriptionId);

  return subscription;
});
