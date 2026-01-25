import { eq } from "drizzle-orm";
import { createError, defineEventHandler, readBody } from "h3";
import { db } from "@/db/db";
import { mpPlan } from "@/db/schema";
import { env } from "@/env";
import { auth } from "@/server/utils/auth";

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

type SubscriptionResponse = {
  id: string;
  status: string;
  reason: string;
  payer_id: number;
  init_point: string;
  date_created: string;
  auto_recurring: {
    frequency: number;
    frequency_type: string;
    transaction_amount: number;
    currency_id: string;
  };
};

function buildSubscriptionData(
  body: CreateSubscriptionBody,
  userId: string | undefined
) {
  const backUrl =
    body.back_url ?? `${env.BETTER_AUTH_URL}/subscriptions/callback`;

  const data: Record<string, unknown> = {
    payer_email: body.payer_email,
    status: "pending",
    back_url: backUrl,
  };

  // Set external_reference for webhook linking (prioritize userId over body)
  const externalRef = userId ?? body.external_reference;
  if (externalRef) {
    data.external_reference = externalRef;
  }

  if (body.preapproval_plan_id) {
    data.preapproval_plan_id = body.preapproval_plan_id;
  } else {
    data.reason = body.reason;

    // Ensure end_date is set (required by Mercado Pago API)
    // Default to 1 year from now if not provided
    const autoRecurring = { ...body.auto_recurring };
    if (!autoRecurring.end_date) {
      const oneYearFromNow = new Date();
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
      autoRecurring.end_date = oneYearFromNow.toISOString();
    }
    data.auto_recurring = autoRecurring;
  }

  if (body.card_token_id) {
    data.card_token_id = body.card_token_id;
  }

  return data;
}

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
  try {
    const body = await readBody<CreateSubscriptionBody>(event);
    validateBody(body);

    // Get authenticated user if available
    const session = await auth.api.getSession({ headers: event.headers });
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

    // Otherwise, call the Mercado Pago API directly (requires card_token_id for plan subscriptions)
    const subscriptionData = buildSubscriptionData(body, userId);

    const response = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.MERCADO_PAGO_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(subscriptionData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.message ||
        errorData.error ||
        errorData.cause?.[0]?.description ||
        "Failed to create subscription";

      throw createError({
        statusCode: response.status,
        message: errorMessage,
      });
    }

    const data: SubscriptionResponse = await response.json();

    return {
      mode: "authorized",
      subscription: {
        id: data.id,
        status: data.status,
        reason: data.reason,
        payerId: data.payer_id,
        initPoint: data.init_point,
        dateCreated: data.date_created,
        autoRecurring: data.auto_recurring,
      },
    };
  } catch (error) {
    if (error instanceof Error && "statusCode" in error) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      message:
        error instanceof Error
          ? error.message
          : "Unknown error creating subscription",
    });
  }
});
