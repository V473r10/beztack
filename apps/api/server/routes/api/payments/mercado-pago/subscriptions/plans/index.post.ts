import { createMercadoPagoClient } from "@beztack/mercadopago/server";
import { createError, defineEventHandler, readBody } from "h3";
import { db } from "@/db/db";
import { mpPlan } from "@/db/schema";
import { env } from "@/env";
import { requireAdmin } from "@/server/utils/require-auth";

const mp = createMercadoPagoClient({
  accessToken: env.MERCADO_PAGO_ACCESS_TOKEN,
  integratorId: env.MERCADO_PAGO_INTEGRATOR_ID,
});

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

export default defineEventHandler(async (event) => {
  // Only admins can create plans
  await requireAdmin(event);

  const body = await readBody<CreatePlanBody>(event);
  validateBody(body);

  const backUrl =
    body.back_url ??
    `${env.APP_URL}/api/payments/mercado-pago/subscriptions/callback`;

  // Create plan via SDK
  const plan = await mp.plans.create({
    reason: body.reason,
    auto_recurring: body.auto_recurring,
    back_url: backUrl,
  });

  // Persist to local database
  await db.insert(mpPlan).values({
    id: plan.id,
    applicationId: plan.application_id ? String(plan.application_id) : null,
    collectorId: plan.collector_id ? String(plan.collector_id) : null,
    reason: plan.reason,
    status: plan.status,
    frequency: plan.auto_recurring.frequency,
    frequencyType: plan.auto_recurring.frequency_type,
    transactionAmount: String(plan.auto_recurring.transaction_amount),
    currencyId: plan.auto_recurring.currency_id,
    repetitions: plan.auto_recurring.repetitions ?? null,
    billingDay: plan.auto_recurring.billing_day ?? null,
    billingDayProportional:
      plan.auto_recurring.billing_day_proportional ?? null,
    freeTrialFrequency: plan.auto_recurring.free_trial?.frequency ?? null,
    freeTrialFrequencyType:
      plan.auto_recurring.free_trial?.frequency_type ?? null,
    initPoint: plan.init_point,
    backUrl: plan.back_url,
    dateCreated: plan.date_created ? new Date(plan.date_created) : null,
    lastModified: plan.last_modified ? new Date(plan.last_modified) : null,
  });

  return {
    id: plan.id,
    status: plan.status,
    reason: plan.reason,
    frequency: plan.auto_recurring.frequency,
    frequencyType: plan.auto_recurring.frequency_type,
    transactionAmount: plan.auto_recurring.transaction_amount,
    currencyId: plan.auto_recurring.currency_id,
    repetitions: plan.auto_recurring.repetitions,
    initPoint: plan.init_point,
    backUrl: plan.back_url,
    dateCreated: plan.date_created,
  };
});
