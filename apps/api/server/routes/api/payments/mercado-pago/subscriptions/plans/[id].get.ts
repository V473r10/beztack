import { createMercadoPagoClient } from "@beztack/mercadopago/server";
import { createError, defineEventHandler, getRouterParam } from "h3";
import { env } from "@/env";

const mp = createMercadoPagoClient({
  accessToken: env.MERCADO_PAGO_ACCESS_TOKEN,
  integratorId: env.MERCADO_PAGO_INTEGRATOR_ID,
});

export default defineEventHandler(async (event) => {
  const planId = getRouterParam(event, "id");

  if (!planId) {
    throw createError({
      statusCode: 400,
      message: "Plan ID is required",
    });
  }

  const plan = await mp.plans.get(planId);

  return plan;
});
