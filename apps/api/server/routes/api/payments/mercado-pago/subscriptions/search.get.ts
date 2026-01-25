import { createMercadoPagoClient } from "@beztack/mercadopago/server";
import { createError, defineEventHandler, getQuery } from "h3";
import { env } from "@/env";
import { requireAuth } from "@/server/utils/require-auth";

const mp = createMercadoPagoClient({
  accessToken: env.MERCADO_PAGO_ACCESS_TOKEN,
});

export default defineEventHandler(async (event) => {
  // Require authentication to search subscriptions
  await requireAuth(event);
  const session = event.context.auth;

  const query = getQuery(event);

  // Build search params
  // For non-admin users, filter by their email to prevent data leaks
  const userEmail = session?.user?.email;
  const isAdmin = session?.user?.role === "admin";

  const searchParams: Parameters<typeof mp.subscriptions.search>[0] = {
    limit: query.limit ? Number(query.limit) : undefined,
    offset: query.offset ? Number(query.offset) : undefined,
  };

  // Status filter
  if (query.status) {
    searchParams.status = String(query.status);
  }

  // Plan filter
  if (query.preapproval_plan_id) {
    searchParams.preapproval_plan_id = String(query.preapproval_plan_id);
  }

  // Email filter - admins can search any email, users can only search their own
  if (query.payer_email) {
    const requestedEmail = String(query.payer_email);
    if (isAdmin || requestedEmail === userEmail) {
      searchParams.payer_email = requestedEmail;
    } else {
      throw createError({
        statusCode: 403,
        message: "Cannot search subscriptions for other users",
      });
    }
  } else if (!isAdmin && userEmail) {
    // Non-admin users always filter by their email
    searchParams.payer_email = userEmail;
  }

  const result = await mp.subscriptions.search(searchParams);

  return {
    subscriptions: result.results,
    total: result.paging.total,
  };
});
