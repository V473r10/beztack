import { createMercadoPagoClient } from "@beztack/mercadopago/server";
import { defineEventHandler } from "h3";
import { db, mpPlan } from "@beztack/db";
import { env } from "@/env";
import { requireAdmin } from "@/server/utils/require-auth";

const mp = createMercadoPagoClient({
  accessToken: env.MERCADO_PAGO_ACCESS_TOKEN,
  integratorId: env.MERCADO_PAGO_INTEGRATOR_ID,
});

type SyncStats = {
  created: number;
  updated: number;
  total: number;
};

export default defineEventHandler(async (event) => {
  // Only admins can trigger sync
  await requireAdmin(event);

  const startTime = Date.now();

  // Fetch all plans from Mercado Pago via SDK
  const mpPlans = await mp.plans.list();

  // Get existing plan IDs
  const existingPlans = await db.select({ id: mpPlan.id }).from(mpPlan);
  const existingIds = new Set(existingPlans.map((p) => p.id));

  const syncedAt = new Date();
  const stats: SyncStats = {
    created: 0,
    updated: 0,
    total: mpPlans.results.length,
  };

  // Sync to database
  for (const plan of mpPlans.results) {
    const { auto_recurring: ar } = plan;
    const isNew = !existingIds.has(plan.id);

    const values = {
      id: plan.id,
      applicationId: plan.application_id ? String(plan.application_id) : null,
      collectorId: plan.collector_id ? String(plan.collector_id) : null,
      reason: plan.reason,
      status: plan.status,
      frequency: ar.frequency,
      frequencyType: ar.frequency_type,
      transactionAmount: String(ar.transaction_amount),
      currencyId: ar.currency_id,
      repetitions: ar.repetitions ?? null,
      billingDay: ar.billing_day ?? null,
      billingDayProportional: ar.billing_day_proportional ?? null,
      freeTrialFrequency: ar.free_trial?.frequency ?? null,
      freeTrialFrequencyType: ar.free_trial?.frequency_type ?? null,
      initPoint: plan.init_point,
      backUrl: plan.back_url ?? null,
      dateCreated: plan.date_created ? new Date(plan.date_created) : null,
      lastModified: plan.last_modified ? new Date(plan.last_modified) : null,
    };

    await db
      .insert(mpPlan)
      .values(values)
      .onConflictDoUpdate({
        target: mpPlan.id,
        set: {
          reason: values.reason,
          status: values.status,
          frequency: values.frequency,
          frequencyType: values.frequencyType,
          transactionAmount: values.transactionAmount,
          currencyId: values.currencyId,
          repetitions: values.repetitions,
          billingDay: values.billingDay,
          billingDayProportional: values.billingDayProportional,
          freeTrialFrequency: values.freeTrialFrequency,
          freeTrialFrequencyType: values.freeTrialFrequencyType,
          initPoint: values.initPoint,
          backUrl: values.backUrl,
          lastModified: values.lastModified,
          updatedAt: syncedAt,
        },
      });

    if (isNew) {
      stats.created++;
    } else {
      stats.updated++;
    }
  }

  const duration = Date.now() - startTime;

  return {
    success: true,
    syncedAt: syncedAt.toISOString(),
    duration: `${duration}ms`,
    stats,
  };
});
