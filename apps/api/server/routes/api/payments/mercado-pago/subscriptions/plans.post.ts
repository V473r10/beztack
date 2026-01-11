import { createError, defineEventHandler, readBody } from "h3";
import { env } from "@/env";

type CreatePlanBody = {
  reason: string;
  auto_recurring: {
    frequency: number;
    frequency_type: "days" | "months";
    transaction_amount: number;
    currency_id: string;
    repetitions?: number;
    free_trial?: {
      frequency: number;
      frequency_type: "days" | "months";
    };
  };
  back_url?: string;
};

type PlanResponse = {
  id: string;
  status: string;
  reason: string;
  auto_recurring: {
    frequency: number;
    frequency_type: string;
    transaction_amount: number;
    currency_id: string;
  };
  date_created: string;
  init_point: string;
};

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<CreatePlanBody>(event);

    if (!(body.reason && body.auto_recurring)) {
      throw createError({
        statusCode: 400,
        message: "Missing required fields: reason or auto_recurring",
      });
    }

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
          back_url:
            body.back_url ?? `${env.BETTER_AUTH_URL}/subscriptions/callback`,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw createError({
        statusCode: response.status,
        message: errorData.message || "Failed to create subscription plan",
      });
    }

    const data: PlanResponse = await response.json();

    return {
      id: data.id,
      status: data.status,
      reason: data.reason,
      auto_recurring: data.auto_recurring,
      date_created: data.date_created,
      init_point: data.init_point,
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
