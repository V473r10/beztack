/**
 * Unified Checkout endpoint
 * Works with both Polar and Mercado Pago based on PAYMENT_PROVIDER config
 */
import { createError, defineEventHandler, readBody } from "h3";
import { z } from "zod";
import { env } from "@/env";
import { getPaymentProvider } from "@/lib/payments";
import { requireAuth } from "@/server/utils/membership";

const checkoutSchema = z.object({
  productId: z.string().min(1),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event);
  const provider = getPaymentProvider();

  try {
    const body = await readBody(event);
    const parsed = checkoutSchema.parse(body);

    const result = await provider.createCheckout({
      productId: parsed.productId,
      customerEmail: user.email,
      successUrl: parsed.successUrl ?? env.POLAR_SUCCESS_URL,
      cancelUrl: parsed.cancelUrl ?? env.POLAR_CANCEL_URL,
      metadata: {
        ...parsed.metadata,
        userId: user.id,
      },
    });

    return {
      provider: provider.provider,
      checkoutId: result.id,
      checkoutUrl: result.url,
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
        error instanceof Error ? error.message : "Failed to create checkout",
    });
  }
});
