/**
 * Update subscription (change plan, pause, resume)
 * Works with both Polar and Mercado Pago based on PAYMENT_PROVIDER config
 */
import { createError, defineEventHandler, getRouterParam, readBody } from "h3";
import { z } from "zod";
import { getPaymentProvider } from "@/lib/payments";
import { requireAuth } from "@/server/utils/membership";

const updateSchema = z.object({
  productId: z.string().optional(),
  status: z.enum(["pause", "resume", "cancel"]).optional(),
  cancelAtPeriodEnd: z.boolean().optional(),
  prorationBehavior: z.enum(["invoice", "prorate", "none"]).optional(),
});

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const provider = getPaymentProvider();

  const subscriptionId = getRouterParam(event, "id");
  if (!subscriptionId) {
    throw createError({
      statusCode: 400,
      message: "Subscription ID is required",
    });
  }

  try {
    const body = await readBody(event);
    const parsed = updateSchema.parse(body);

    const subscription = await provider.updateSubscription(
      subscriptionId,
      parsed
    );

    return {
      provider: provider.provider,
      subscription,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        message: "Invalid request data",
      });
    }

    throw createError({
      statusCode: 500,
      message:
        error instanceof Error
          ? error.message
          : "Failed to update subscription",
    });
  }
});
