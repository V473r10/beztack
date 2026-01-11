import { createError, defineEventHandler, readBody } from "h3";
import { env } from "@/env";

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

function buildSubscriptionData(body: CreateSubscriptionBody) {
  const backUrl =
    body.back_url ?? `${env.BETTER_AUTH_URL}/subscriptions/callback`;

  const data: Record<string, unknown> = {
    payer_email: body.payer_email,
    status: "pending",
    back_url: backUrl,
  };

  if (body.preapproval_plan_id) {
    data.preapproval_plan_id = body.preapproval_plan_id;
  } else {
    data.reason = body.reason;
    data.auto_recurring = body.auto_recurring;
  }

  if (body.card_token_id) {
    data.card_token_id = body.card_token_id;
  }

  if (body.external_reference) {
    data.external_reference = body.external_reference;
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

    const subscriptionData = buildSubscriptionData(body);

    const response = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.MERCADO_PAGO_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(subscriptionData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw createError({
        statusCode: response.status,
        message: errorData.message || "Failed to create subscription",
      });
    }

    const data: SubscriptionResponse = await response.json();

    return {
      id: data.id,
      status: data.status,
      reason: data.reason,
      payer_id: data.payer_id,
      init_point: data.init_point,
      date_created: data.date_created,
      auto_recurring: data.auto_recurring,
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
