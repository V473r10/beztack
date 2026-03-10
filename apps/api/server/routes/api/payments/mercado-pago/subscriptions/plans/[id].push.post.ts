import { db, mpPlan } from "@beztack/db";
import { createMercadoPagoClient } from "@beztack/mercadopago/server";
import { eq } from "drizzle-orm";
import { createError, defineEventHandler, getRouterParam } from "h3";
import { env } from "@/env";
import { requireAdmin } from "@/server/utils/require-auth";

const mp = createMercadoPagoClient({
  accessToken: env.MERCADO_PAGO_ACCESS_TOKEN,
  integratorId: env.MERCADO_PAGO_INTEGRATOR_ID,
});

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const planId = getRouterParam(event, "id");
  if (!planId) {
    throw createError({
      statusCode: 400,
      message: "Plan ID is required",
    });
  }

  const [localPlan] = await db
    .select()
    .from(mpPlan)
    .where(eq(mpPlan.id, planId))
    .limit(1);

  if (!localPlan) {
    throw createError({
      statusCode: 404,
      message: `Plan ${planId} not found in local DB`,
    });
  }

  // Push local plan data to Mercado Pago (only updatable fields)
  const updated = await mp.plans.update(planId, {
    reason: localPlan.displayName ?? localPlan.reason,
    auto_recurring: {
      transaction_amount: Number(localPlan.transactionAmount),
      ...(localPlan.billingDay != null
        ? { billing_day: localPlan.billingDay }
        : {}),
    },
  });

  // Update local record with any changes from MP response
  await db
    .update(mpPlan)
    .set({
      reason: updated.reason ?? localPlan.reason,
      status: updated.status ?? localPlan.status,
      lastModified: updated.last_modified
        ? new Date(updated.last_modified)
        : new Date(),
    })
    .where(eq(mpPlan.id, planId));

  return {
    success: true,
    planId,
    mpStatus: updated.status,
    pushedAt: new Date().toISOString(),
  };
});
