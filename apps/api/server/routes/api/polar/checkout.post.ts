import { Polar } from "@polar-sh/sdk";
import { createError, defineEventHandler, readBody } from "h3";
import { z } from "zod";
import { env } from "@/env";

// Constants for validation
const MIN_AMOUNT_CENTS = 50;
const MAX_AMOUNT_CENTS = 99_999_999;

// HTTP status codes
const HTTP_VALIDATION_ERROR = 422;
const HTTP_UNAUTHORIZED = 401;

// Polar API error interface
type PolarApiError = {
  status: number;
  body?: {
    detail?: string;
  };
};

// Helper function to handle Polar API errors
function handlePolarApiError(error: unknown) {
  if (error && typeof error === "object" && "status" in error) {
    const polarError = error as PolarApiError;

    if (polarError.status === HTTP_VALIDATION_ERROR) {
      throw createError({
        statusCode: HTTP_VALIDATION_ERROR,
        statusMessage: "Validation error from Polar API",
        data: polarError.body?.detail || "Invalid product or request data",
      });
    }

    if (polarError.status === HTTP_UNAUTHORIZED) {
      throw createError({
        statusCode: HTTP_UNAUTHORIZED,
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

const checkoutRequestSchema = z.object({
  productId: z.string().uuid(),
  successUrl: z.string().url().optional(),
  customerEmail: z.string().email().optional(),
  customerName: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  customFieldData: z.record(z.string(), z.any()).optional(),
  allowDiscountCodes: z.boolean().optional(),
  requireBillingAddress: z.boolean().optional(),
  amount: z.number().min(MIN_AMOUNT_CENTS).max(MAX_AMOUNT_CENTS).optional(),
});

export default defineEventHandler(async (event) => {
  const polar = new Polar({
    accessToken: env.POLAR_ACCESS_TOKEN,
    server: env.POLAR_SERVER,
  });
  if (event.node.req.method !== "POST") {
    throw createError({
      statusCode: 405,
      statusMessage: "Method not allowed",
    });
  }

  try {
    const body = await readBody(event);
    const parsed = checkoutRequestSchema.parse(body);

    const checkout = await polar.checkouts.create({
      products: [parsed.productId],
    });

    return {
      success: true,
      checkoutUrl: checkout.url,
      checkoutId: checkout.id,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid request data",
        data: error.message,
      });
    }

    handlePolarApiError(error);
  }
});
