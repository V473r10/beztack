import { createError, defineEventHandler, getRouterParam } from "h3";
import { env } from "@/env";

export default defineEventHandler(async (event) => {
  try {
    const subscriptionId = getRouterParam(event, "id");

    if (!subscriptionId) {
      throw createError({
        statusCode: 400,
        message: "Subscription ID is required",
      });
    }

    const response = await fetch(
      `https://api.mercadopago.com/preapproval/${subscriptionId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${env.MERCADO_PAGO_ACCESS_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw createError({
        statusCode: response.status,
        message: errorData.message || "Failed to get subscription",
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
          : "Unknown error getting subscription",
    });
  }
});
