import { Polar } from "@polar-sh/sdk";
import { createError, defineEventHandler, readBody } from "h3";
import { z } from "zod";
import { env } from "@/env";
import { requireAuth } from "@/server/utils/membership";

// HTTP status codes
const HTTP_VALIDATION_ERROR = 422;
const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;
const HTTP_FORBIDDEN = 403;

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
        data: polarError.body?.detail || "Invalid subscription or product data",
      });
    }

    if (polarError.status === HTTP_UNAUTHORIZED) {
      throw createError({
        statusCode: HTTP_UNAUTHORIZED,
        statusMessage: "Unauthorized: Invalid Polar API credentials",
      });
    }

    if (polarError.status === HTTP_NOT_FOUND) {
      throw createError({
        statusCode: HTTP_NOT_FOUND,
        statusMessage: "Subscription not found",
      });
    }
  }

  throw createError({
    statusCode: 500,
    statusMessage: "Failed to update subscription",
    data: error instanceof Error ? error.message : "Unknown error",
  });
}

const subscriptionUpdateSchema = z.object({
  subscriptionId: z.string().uuid(),
  productId: z.string().uuid(),
  prorationBehavior: z.enum(["invoice", "prorate"]).default("prorate"),
});

export default defineEventHandler(async (event) => {
  if (event.node.req.method !== "PATCH") {
    throw createError({
      statusCode: 405,
      statusMessage: "Method not allowed",
    });
  }

  // Require authentication
  const { user } = await requireAuth(event);

  const polar = new Polar({
    accessToken: env.POLAR_ACCESS_TOKEN,
    server: env.POLAR_SERVER,
  });

  try {
    const body = await readBody(event);
    const parsed = subscriptionUpdateSchema.parse(body);

    // Get the subscription first to verify ownership
    const subscription = await polar.subscriptions.get({
      id: parsed.subscriptionId,
    });

    // Verify the subscription belongs to this user or their organization
    const customerMetadata = subscription.customer?.metadata as
      | Record<string, unknown>
      | undefined;
    const subscriptionUserId = customerMetadata?.userId as string | undefined;
    const subscriptionExternalId = subscription.customer?.externalId;

    const isOwner =
      subscriptionUserId === user.id || subscriptionExternalId === user.id;

    if (!isOwner) {
      throw createError({
        statusCode: HTTP_FORBIDDEN,
        statusMessage: "You do not have permission to modify this subscription",
      });
    }

    // Update the subscription to the new product
    const updatedSubscription = await polar.subscriptions.update({
      id: parsed.subscriptionId,
      subscriptionUpdate: {
        productId: parsed.productId,
        prorationBehavior: parsed.prorationBehavior,
      },
    });

    return {
      success: true,
      subscription: {
        id: updatedSubscription.id,
        status: updatedSubscription.status,
        productId: updatedSubscription.productId,
        amount: updatedSubscription.amount,
        currency: updatedSubscription.currency,
        currentPeriodEnd: updatedSubscription.currentPeriodEnd,
        recurringInterval: updatedSubscription.recurringInterval,
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid request data",
        data: error.message,
      });
    }

    // Re-throw H3 errors
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }

    handlePolarApiError(error);
  }
});
