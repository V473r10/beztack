import { createError, defineEventHandler, getRouterParam } from "h3";
import { env } from "@/env";

export default defineEventHandler(async (event) => {
  try {
    const planId = getRouterParam(event, "id");

    if (!planId) {
      throw createError({
        statusCode: 400,
        message: "Plan ID is required",
      });
    }

    const response = await fetch(
      `https://api.mercadopago.com/preapproval_plan/${planId}`,
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
        message: errorData.message || "Failed to get subscription plan",
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
        error instanceof Error ? error.message : "Unknown error getting plan",
    });
  }
});
