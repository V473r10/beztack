import { createPolarClient } from "@nvn/payments/server";
import { createError, defineEventHandler, readBody } from "h3";
import { z } from "zod";

const checkoutRequestSchema = z.object({
  productId: z.string().uuid(),
  successUrl: z.string().url().optional(),
  customerEmail: z.string().email().optional(),
  customerName: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  customFieldData: z.record(z.any()).optional(),
  allowDiscountCodes: z.boolean().optional(),
  requireBillingAddress: z.boolean().optional(),
  amount: z.number().min(50).max(99_999_999).optional(),
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
    const checkoutData = {
      products: [parsed.productId], // Required: array of product IDs
      success_url:
        parsed.successUrl ||
        `${process.env.FRONTEND_URL}/dashboard?checkout=success`,
      ...(parsed.customerEmail && { customer_email: parsed.customerEmail }),
      ...(parsed.customerName && { customer_name: parsed.customerName }),
      ...(parsed.metadata && { metadata: parsed.metadata }),
      ...(parsed.customFieldData && {
        custom_field_data: parsed.customFieldData,
      }),
      ...(parsed.allowDiscountCodes !== undefined && {
        allow_discount_codes: parsed.allowDiscountCodes,
      }),
      ...(parsed.requireBillingAddress !== undefined && {
        require_billing_address: parsed.requireBillingAddress,
      }),
      ...(parsed.amount && { amount: parsed.amount }),
    };

    const checkout = await polar.checkouts.create(checkoutData);

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

    // Handle Polar API errors
    if (error && typeof error === "object" && "status" in error) {
      const polarError = error as any;

      if (polarError.status === 422) {
        throw createError({
          statusCode: 422,
          statusMessage: "Validation error from Polar API",
          data: polarError.body?.detail || "Invalid product or request data",
        });
      }

      if (polarError.status === 401) {
        throw createError({
          statusCode: 401,
          statusMessage: "Unauthorized: Invalid Polar API credentials",
        });
      }
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Failed to create checkout session",
      data: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
