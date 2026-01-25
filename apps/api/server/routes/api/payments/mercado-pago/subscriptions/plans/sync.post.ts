import { createError, defineEventHandler } from "h3";
import { db } from "@/db/db";
import { mpPlan } from "@/db/schema";
import { env } from "@/env";

type MPPlanResponse = {
  id: string;
  status: string;
  reason: string;
  application_id: number;
  collector_id: number;
  init_point: string;
  back_url: string;
  date_created: string;
  last_modified: string;
  auto_recurring: {
    frequency: number;
    frequency_type: string;
    transaction_amount: number;
    currency_id: string;
    repetitions?: number;
    billing_day?: number;
    billing_day_proportional?: boolean;
    free_trial?: {
      frequency: number;
      frequency_type: string;
    };
  };
};

type MPSearchResponse = {
  results: MPPlanResponse[];
  paging: {
    total: number;
    offset: number;
    limit: number;
  };
};

type SyncStats = {
  created: number;
  updated: number;
  total: number;
};

async function fetchAllPlansFromMP(): Promise<MPPlanResponse[]> {
  const response = await fetch(
    "https://api.mercadopago.com/preapproval_plan/search",
    {
      headers: {
        Authorization: `Bearer ${env.MERCADO_PAGO_ACCESS_TOKEN}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw createError({
      statusCode: response.status,
      message: error.message || "Failed to fetch plans from Mercado Pago",
    });
  }

  const data: MPSearchResponse = await response.json();
  return data.results;
}

function mapMPPlanToDbValues(plan: MPPlanResponse) {
  const { auto_recurring: ar } = plan;
  return {
    id: plan.id,
    applicationId: String(plan.application_id),
    collectorId: String(plan.collector_id),
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
    backUrl: plan.back_url,
    dateCreated: plan.date_created ? new Date(plan.date_created) : null,
    lastModified: plan.last_modified ? new Date(plan.last_modified) : null,
  };
}

async function syncPlansToDatabase(
  mpPlans: MPPlanResponse[]
): Promise<SyncStats> {
  const syncedAt = new Date();
  const stats: SyncStats = { created: 0, updated: 0, total: mpPlans.length };

  // Get existing plan IDs
  const existingPlans = await db.select({ id: mpPlan.id }).from(mpPlan);
  const existingIds = new Set(existingPlans.map((p) => p.id));

  for (const plan of mpPlans) {
    const values = mapMPPlanToDbValues(plan);
    const isNew = !existingIds.has(plan.id);

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

  return stats;
}

export default defineEventHandler(async () => {
  try {
    const startTime = Date.now();

    // Fetch all plans from Mercado Pago
    const mpPlans = await fetchAllPlansFromMP();

    // Sync to database
    const stats = await syncPlansToDatabase(mpPlans);

    const duration = Date.now() - startTime;

    return {
      success: true,
      syncedAt: new Date().toISOString(),
      duration: `${duration}ms`,
      stats,
    };
  } catch (error) {
    if (error instanceof Error && "statusCode" in error) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      message:
        error instanceof Error ? error.message : "Unknown error syncing plans",
    });
  }
});
