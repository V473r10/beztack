import { createError, defineEventHandler, getRouterParam, readBody } from "h3";
import { env } from "@/env";

type UpdateSubscriptionBody = {
  status?: "authorized" | "paused" | "cancelled";
  card_token_id?: string;
  auto_recurring?: {
    transaction_amount?: number;
  };
};

export default defineEventHandler(async (event) => {
  try {
    const subscriptionId = getRouterParam(event, "id");
    const body = await readBody<UpdateSubscriptionBody>(event);

    if (!subscriptionId) {
      throw createError({
        statusCode: 400,
        message: "Subscription ID is required",
      });
    }

    const response = await fetch(
      `https://api.mercadopago.com/preapproval/${subscriptionId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.MERCADO_PAGO_ACCESS_TOKEN}`,
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw createError({
        statusCode: response.status,
        message: errorData.message || "Failed to update subscription",
      });
    }

    return response.json();
  } catch (error) {
    if (error instanceof Error && "statusCode" in error) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      message:
        error instanceof Error
          ? error.message
          : "Unknown error updating subscription",
    });
  }
});
