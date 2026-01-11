import { createError, defineEventHandler, getQuery } from "h3";
import { env } from "@/env";

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const params = new URLSearchParams();

    if (query.payer_email) {
      params.append("payer_email", String(query.payer_email));
    }
    if (query.status) {
      params.append("status", String(query.status));
    }
    if (query.preapproval_plan_id) {
      params.append("preapproval_plan_id", String(query.preapproval_plan_id));
    }
    if (query.offset) {
      params.append("offset", String(query.offset));
    }
    if (query.limit) {
      params.append("limit", String(query.limit));
    }

    const url = `https://api.mercadopago.com/preapproval/search?${params.toString()}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${env.MERCADO_PAGO_ACCESS_TOKEN}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw createError({
        statusCode: response.status,
        message: errorData.message || "Failed to search subscriptions",
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
          : "Unknown error searching subscriptions",
    });
  }
});
