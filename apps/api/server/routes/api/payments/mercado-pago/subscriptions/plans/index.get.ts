import { desc, eq } from "drizzle-orm";
import { createError, defineEventHandler, getQuery } from "h3";
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

async function fetchPlansFromMP(): Promise<MPPlanResponse[]> {
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

async function syncPlansToDatabase(mpPlans: MPPlanResponse[]) {
  const syncedAt = new Date();

  for (const plan of mpPlans) {
    const values = mapMPPlanToDbValues(plan);
    await db
      .insert(mpPlan)
      .values(values)
      .onConflictDoUpdate({
        target: mpPlan.id,
        set: {
          ...values,
          id: undefined, // Don't update the primary key
          dateCreated: undefined, // Don't overwrite original creation date
          updatedAt: syncedAt,
        },
      });
  }

  return syncedAt;
}

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const refresh = query.refresh === "true";
    const status = query.status as string | undefined;

    let syncedAt: Date | null = null;

    // If refresh requested or no plans in DB, sync from MP
    if (refresh) {
      const mpPlans = await fetchPlansFromMP();
      syncedAt = await syncPlansToDatabase(mpPlans);
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
      const mpPlans = await fetchPlansFromMP();
      syncedAt = await syncPlansToDatabase(mpPlans);

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
  } catch (error) {
    if (error instanceof Error && "statusCode" in error) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      message:
        error instanceof Error ? error.message : "Unknown error fetching plans",
    });
  }
});
