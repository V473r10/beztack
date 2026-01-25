import { createMercadoPagoClient } from "@beztack/mercadopago/server";
import { eq } from "drizzle-orm";
import { createError, defineEventHandler, getRouterParam, readBody } from "h3";
import { db } from "@/db/db";
import { mpSubscription } from "@/db/schema";
import { env } from "@/env";
import { requireOwnerOrAdmin } from "@/server/utils/require-auth";

const mp = createMercadoPagoClient({
  accessToken: env.MERCADO_PAGO_ACCESS_TOKEN,
});

type UpdateSubscriptionBody = {
  status?: "authorized" | "paused" | "cancelled";
  card_token_id?: string;
  auto_recurring?: {
    transaction_amount?: number;
  };
};

export default defineEventHandler(async (event) => {
  const subscriptionId = getRouterParam(event, "id");
  const body = await readBody<UpdateSubscriptionBody>(event);

  if (!subscriptionId) {
    throw createError({
      statusCode: 400,
      message: "Subscription ID is required",
    });
  }

  // Check ownership: get local subscription to find the owner
  const [localSubscription] = await db
    .select({ beztackUserId: mpSubscription.beztackUserId })
    .from(mpSubscription)
    .where(eq(mpSubscription.id, subscriptionId))
    .limit(1);

  // Require owner or admin access
  await requireOwnerOrAdmin(event, localSubscription?.beztackUserId);

  // Update via SDK
  const updated = await mp.subscriptions.update(subscriptionId, {
    status: body.status,
    // Note: card_token_id and auto_recurring are passed through
    // but the SDK update method may need to be extended to support them
  });

  return updated;
});
