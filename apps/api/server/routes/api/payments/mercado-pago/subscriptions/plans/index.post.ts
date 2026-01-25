import { createError, defineEventHandler, readBody } from "h3";
import { db } from "@/db/db";
import { mpPlan } from "@/db/schema";
import { env } from "@/env";

type CreatePlanBody = {
  reason: string;
  auto_recurring: {
    frequency: number;
    frequency_type: "days" | "months";
    transaction_amount: number;
    currency_id: string;
    repetitions?: number;
    billing_day?: number;
    billing_day_proportional?: boolean;
    free_trial?: {
      frequency: number;
      frequency_type: "days" | "months";
    };
  };
  back_url?: string;
};

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

function validateBody(body: CreatePlanBody) {
  if (!body.reason?.trim()) {
    throw createError({
      statusCode: 400,
      message: "Missing required field: reason",
    });
  }

  if (!body.auto_recurring) {
    throw createError({
      statusCode: 400,
      message: "Missing required field: auto_recurring",
    });
  }

  const ar = body.auto_recurring;
  if (!ar.frequency || ar.frequency < 1) {
    throw createError({
      statusCode: 400,
      message: "auto_recurring.frequency must be a positive number",
    });
  }

  if (!["days", "months"].includes(ar.frequency_type)) {
    throw createError({
      statusCode: 400,
      message: "auto_recurring.frequency_type must be 'days' or 'months'",
    });
  }

  if (!ar.transaction_amount || ar.transaction_amount <= 0) {
    throw createError({
      statusCode: 400,
      message: "auto_recurring.transaction_amount must be a positive number",
    });
  }

  if (!ar.currency_id?.trim()) {
    throw createError({
      statusCode: 400,
      message: "auto_recurring.currency_id is required",
    });
  }
}

async function persistPlanToDatabase(plan: MPPlanResponse) {
  const { auto_recurring: ar } = plan;

  await db.insert(mpPlan).values({
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
  });
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<CreatePlanBody>(event);
    validateBody(body);

    const backUrl =
      body.back_url ?? `${env.BETTER_AUTH_URL}/subscriptions/callback`;

    const response = await fetch(
      "https://api.mercadopago.com/preapproval_plan",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.MERCADO_PAGO_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          reason: body.reason,
          auto_recurring: body.auto_recurring,
          back_url: backUrl,
        }),
      }
    );

    if (!response.ok) {
      let errorMessage = "Failed to create subscription plan";

      try {
        const errorData = await response.json();
        errorMessage =
          errorData.message ||
          errorData.error ||
          errorData.cause?.[0]?.description ||
          errorMessage;
      } catch {
        // Ignore JSON parse errors
      }

      throw createError({
        statusCode: response.status,
        message: errorMessage,
      });
    }

    const data: MPPlanResponse = await response.json();

    // Persist to local database
    await persistPlanToDatabase(data);

    return {
      id: data.id,
      status: data.status,
      reason: data.reason,
      frequency: data.auto_recurring.frequency,
      frequencyType: data.auto_recurring.frequency_type,
      transactionAmount: data.auto_recurring.transaction_amount,
      currencyId: data.auto_recurring.currency_id,
      repetitions: data.auto_recurring.repetitions,
      initPoint: data.init_point,
      backUrl: data.back_url,
      dateCreated: data.date_created,
    };
  } catch (error) {
    if (error instanceof Error && "statusCode" in error) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      message:
        error instanceof Error ? error.message : "Unknown error creating plan",
    });
  }
});
