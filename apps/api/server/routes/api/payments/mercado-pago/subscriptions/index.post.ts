import { createMercadoPagoClient } from "@beztack/mercadopago/server";
import { eq } from "drizzle-orm";
import { createError, defineEventHandler, readBody } from "h3";
import { db } from "@/db/db";
import { mpPlan } from "@/db/schema";
import { env } from "@/env";
import { getOptionalSession } from "@/server/utils/require-auth";

const mp = createMercadoPagoClient({
  accessToken: env.MERCADO_PAGO_ACCESS_TOKEN,
});

type CreateSubscriptionBody = {
  preapproval_plan_id?: string;
  reason?: string;
  payer_email: string;
  card_token_id?: string;
  auto_recurring?: {
    frequency: number;
    frequency_type: "days" | "months";
    transaction_amount: number;
    currency_id: string;
    start_date?: string;
    end_date?: string;
  };
  back_url?: string;
  external_reference?: string;
  /** If true and using plan, return checkout URL instead of calling API */
  use_checkout?: boolean;
};

function validateBody(body: CreateSubscriptionBody) {
  if (!body.payer_email) {
    throw createError({
      statusCode: 400,
      message: "Missing required field: payer_email",
    });
  }

  if (!(body.preapproval_plan_id || body.auto_recurring)) {
    throw createError({
      statusCode: 400,
      message: "Either preapproval_plan_id or auto_recurring must be provided",
    });
  }
}

export default defineEventHandler(async (event) => {
  const body = await readBody<CreateSubscriptionBody>(event);
  validateBody(body);

  // Get authenticated user if available
  const session = await getOptionalSession(event);
  const userId = session?.user?.id;

  // If using a plan and requesting checkout mode, return the plan's init_point
  if (body.preapproval_plan_id && body.use_checkout !== false) {
    const [plan] = await db
      .select()
      .from(mpPlan)
      .where(eq(mpPlan.id, body.preapproval_plan_id))
      .limit(1);

    if (plan?.initPoint) {
      return {
        mode: "checkout",
        plan: {
          id: plan.id,
          reason: plan.reason,
          transactionAmount: plan.transactionAmount,
          currencyId: plan.currencyId,
          frequency: plan.frequency,
          frequencyType: plan.frequencyType,
        },
        checkoutUrl: plan.initPoint,
      };
    }
  }

  // Build subscription data
  const backUrl =
    body.back_url ??
    `${env.APP_URL}/api/payments/mercado-pago/subscriptions/callback`;
  const externalRef = userId ?? body.external_reference;

  // Ensure end_date is set for non-plan subscriptions (required by MP API)
  let autoRecurring = body.auto_recurring;
  if (autoRecurring && !autoRecurring.end_date) {
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    autoRecurring = {
      ...autoRecurring,
      end_date: oneYearFromNow.toISOString(),
    };
  }

  // Call SDK to create subscription
  const subscription = await mp.subscriptions.create({
    preapproval_plan_id: body.preapproval_plan_id,
    payer_email: body.payer_email,
    card_token_id: body.card_token_id,
    back_url: backUrl,
    external_reference: externalRef,
    reason: body.reason,
    auto_recurring: autoRecurring,
    status: "pending",
  });

  return {
    mode: "authorized",
    subscription: {
      id: subscription.id,
      status: subscription.status,
      reason: subscription.reason,
      payerId: subscription.payer_id,
      initPoint: subscription.init_point,
      dateCreated: subscription.date_created,
      autoRecurring: subscription.auto_recurring,
    },
  };
});
