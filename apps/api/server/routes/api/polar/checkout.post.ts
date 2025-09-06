import { createPolarClient } from "@nvn/payments/server";
import { defineEventHandler, readBody, createError } from "h3";
import { z } from "zod";

const checkoutRequestSchema = z.object({
  productId: z.string(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  customerEmail: z.string().email().optional(),
  metadata: z.record(z.any()).optional(),
});

export default defineEventHandler(async (event) => {
  if (event.node.req.method !== "POST") {
    throw createError({
      statusCode: 405,
      statusMessage: "Method not allowed",
    });
  }

  try {
    const body = await readBody(event);
    const parsed = checkoutRequestSchema.parse(body);

    const polar = createPolarClient();

    // Create checkout session with Polar
    const checkout = await polar.checkouts.create({
      productPrices: [parsed.productId],
      successUrl: parsed.successUrl || `${process.env.FRONTEND_URL}/dashboard?checkout=success`,
      customerEmail: parsed.customerEmail,
      metadata: parsed.metadata,
    } as any);

    return {
      success: true,
      checkoutUrl: checkout.url,
      checkoutId: checkout.id,
    };
  } catch (error) {
    console.error("Polar checkout error:", error);
    
    if (error instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid request data",
        data: error.errors,
      });
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Failed to create checkout session",
    });
  }
});
