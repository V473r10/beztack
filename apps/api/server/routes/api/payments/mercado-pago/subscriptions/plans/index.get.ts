import { createMercadoPagoClient } from "@beztack/mercadopago/server";
import { desc, eq } from "drizzle-orm";
import { defineEventHandler, getQuery } from "h3";
import { db, mpPlan } from "@beztack/db";
import { env } from "@/env";

const mp = createMercadoPagoClient({
  accessToken: env.MERCADO_PAGO_ACCESS_TOKEN,
  integratorId: env.MERCADO_PAGO_INTEGRATOR_ID,
});

async function syncPlansToDatabase() {
  const mpPlans = await mp.plans.list();
  const syncedAt = new Date();

  for (const plan of mpPlans.results) {
    const { auto_recurring: ar } = plan;
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
  }

  return syncedAt;
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const refresh = query.refresh === "true";
  const status = query.status as string | undefined;

  let syncedAt: Date | null = null;

  // If refresh requested, sync from MP
  if (refresh) {
    syncedAt = await syncPlansToDatabase();
  }

  // Query local database
  const whereClause = status ? eq(mpPlan.status, status) : undefined;
  const plans = await db
    .select()
    .from(mpPlan)
    .where(whereClause)
    .orderBy(desc(mpPlan.dateCreated));

  // If no plans and didn't just sync, try syncing
  if (plans.length === 0 && !refresh) {
    syncedAt = await syncPlansToDatabase();

    const freshPlans = await db
      .select()
      .from(mpPlan)
      .where(whereClause)
      .orderBy(desc(mpPlan.dateCreated));

    return {
      plans: freshPlans,
      syncedAt: syncedAt?.toISOString() ?? null,
      total: freshPlans.length,
    };
  }

  return {
    plans,
    syncedAt: syncedAt?.toISOString() ?? null,
    total: plans.length,
  };
});
