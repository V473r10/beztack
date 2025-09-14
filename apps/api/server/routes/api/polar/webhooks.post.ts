import {
  createDefaultWebhookHandlers,
  handleWebhookRequest,
} from "@nvn/payments/server";
import { eq } from "drizzle-orm";
import { createError, defineEventHandler } from "h3";
import { db } from "@/db/db";
import { schema } from "@/db/schema";

// Constants
const DEFAULT_SUBSCRIPTION_DAYS = 30;
const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1000;
const MILLISECONDS_PER_DAY =
  HOURS_PER_DAY *
  MINUTES_PER_HOUR *
  SECONDS_PER_MINUTE *
  MILLISECONDS_PER_SECOND;

// Helper function to update organization subscription
async function updateOrganizationSubscription(
  organizationId: string,
  updates: Record<string, unknown>
) {
  try {
    await db
      .update(schema.organization)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.organization.id, organizationId));
  } catch (_error) {
    // Log error in production, ignore in development for now
  }
}

// Helper function to update user subscription
async function updateUserSubscription(
  userId: string,
  updates: Record<string, unknown>
) {
  try {
    await db
      .update(schema.user)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.user.id, userId));
  } catch (_error) {
    // Log error in production, ignore in development for now
  }
}

// Helper function to handle organization-level order payment
async function handleOrganizationOrderPaid(
  organizationId: string,
  customerInfo: { customerId: string; tier: string }
) {
  const updates = {
    subscriptionTier: customerInfo.tier,
    subscriptionStatus: "active",
    polarCustomerId: customerInfo.customerId,
    subscriptionValidUntil: new Date(
      Date.now() + DEFAULT_SUBSCRIPTION_DAYS * MILLISECONDS_PER_DAY
    ),
  };
  await updateOrganizationSubscription(organizationId, updates);
}

// Helper function to handle user-level order payment
async function handleUserOrderPaid(
  userId: string,
  customerInfo: { customerId: string; tier: string }
) {
  const updates = {
    subscriptionTier: customerInfo.tier,
    subscriptionStatus: "active",
    polarCustomerId: customerInfo.customerId,
    subscriptionValidUntil: new Date(
      Date.now() + DEFAULT_SUBSCRIPTION_DAYS * MILLISECONDS_PER_DAY
    ),
  };
  await updateUserSubscription(userId, updates);
}

// Helper function to handle subscription activation
async function handleSubscriptionActivation(
  payload: {
    data: {
      metadata?: { referenceId?: string; userId?: string; tier?: string };
      id: string;
      customer_id: string;
      current_period_end?: string;
    };
  },
  isOrganization: boolean
) {
  const targetId = isOrganization
    ? payload.data.metadata?.referenceId
    : payload.data.metadata?.userId;

  if (!targetId) {
    return;
  }

  const tierName =
    payload.data.metadata?.tier || (isOrganization ? "team" : "pro");
  const updates = {
    subscriptionTier: tierName,
    subscriptionStatus: "active" as const,
    subscriptionId: payload.data.id,
    polarCustomerId: payload.data.customer_id,
    subscriptionValidUntil: payload.data.current_period_end
      ? new Date(payload.data.current_period_end)
      : null,
  };

  if (isOrganization) {
    await updateOrganizationSubscription(targetId, updates);
  } else {
    await updateUserSubscription(targetId, updates);
  }
}

// Helper function to handle subscription cancellation
async function handleSubscriptionCancellation(
  payload: {
    data: {
      metadata?: { referenceId?: string; userId?: string };
      current_period_end?: string;
    };
  },
  isOrganization: boolean
) {
  const targetId = isOrganization
    ? payload.data.metadata?.referenceId
    : payload.data.metadata?.userId;

  if (!targetId) {
    return;
  }

  const updates = {
    subscriptionStatus: "canceled" as const,
    subscriptionValidUntil: payload.data.current_period_end
      ? new Date(payload.data.current_period_end)
      : new Date(),
  };

  if (isOrganization) {
    await updateOrganizationSubscription(targetId, updates);
  } else {
    await updateUserSubscription(targetId, updates);
  }
}

// Helper function to build updates for active subscription
function buildActiveSubscriptionUpdates(
  polarCustomerId: string,
  activeSubscription:
    | { metadata?: { tier?: string }; id: string; current_period_end?: string }
    | undefined,
  defaultTier: string
): Record<string, unknown> {
  const updates: Record<string, unknown> = {
    polarCustomerId,
  };

  if (activeSubscription) {
    updates.subscriptionTier = activeSubscription.metadata?.tier || defaultTier;
    updates.subscriptionStatus = "active";
    updates.subscriptionId = activeSubscription.id;
    updates.subscriptionValidUntil = activeSubscription.current_period_end
      ? new Date(activeSubscription.current_period_end)
      : null;
  }

  return updates;
}

// Helper function to handle user customer state change
async function handleUserCustomerStateChange(
  userId: string,
  payload: {
    data: {
      id: string;
      subscriptions?: Array<{
        status: string;
        metadata?: { tier?: string };
        id: string;
        current_period_end?: string;
      }>;
    };
  }
) {
  const activeSubscription = payload.data.subscriptions?.find(
    (sub) => sub.status === "active"
  );

  const updates = buildActiveSubscriptionUpdates(
    payload.data.id,
    activeSubscription,
    "pro"
  );

  await updateUserSubscription(userId, updates);
}

// Helper function to handle organization customer state change
async function handleOrganizationCustomerStateChange(
  organizationId: string,
  payload: {
    data: {
      id: string;
      subscriptions?: Array<{
        status: string;
        metadata?: { tier?: string };
        id: string;
        current_period_end?: string;
      }>;
    };
  }
) {
  const activeSubscription = payload.data.subscriptions?.find(
    (sub) => sub.status === "active"
  );

  const updates = buildActiveSubscriptionUpdates(
    payload.data.id,
    activeSubscription,
    "team"
  );

  await updateOrganizationSubscription(organizationId, updates);
}

export default defineEventHandler(async (event) => {
  try {
    // Create webhook handlers with proper database integration
    const webhookHandlers = createDefaultWebhookHandlers({
      onOrderPaid: async (payload) => {
        // Handle organization-level subscription
        if (payload.data.metadata?.referenceId) {
          const organizationId = payload.data.metadata.referenceId;
          const tierName = payload.data.metadata?.tier || "pro";
          const customerInfo = {
            customerId: payload.data.customer_id,
            tier: tierName,
          };
          await handleOrganizationOrderPaid(organizationId, customerInfo);
        }

        // Handle individual user subscription
        if (payload.data.metadata?.userId) {
          const userId = payload.data.metadata.userId;
          const tierName = payload.data.metadata?.tier || "pro";
          const customerInfo = {
            customerId: payload.data.customer_id,
            tier: tierName,
          };
          await handleUserOrderPaid(userId, customerInfo);
        }
      },

      onSubscriptionActive: async (payload) => {
        // Handle organization-level subscription activation
        if (payload.data.metadata?.referenceId) {
          await handleSubscriptionActivation(payload, true);
        }

        // Handle individual user subscription activation
        if (payload.data.metadata?.userId) {
          await handleSubscriptionActivation(payload, false);
        }
      },

      onSubscriptionCanceled: async (payload) => {
        // Handle organization-level subscription cancellation
        if (payload.data.metadata?.referenceId) {
          await handleSubscriptionCancellation(payload, true);
        }

        // Handle individual user subscription cancellation
        if (payload.data.metadata?.userId) {
          await handleSubscriptionCancellation(payload, false);
        }
      },

      onCustomerStateChanged: async (payload) => {
        // Update user/customer data in database
        // Find user by Polar customer metadata (userId or external_id)
        const userId =
          payload.data.metadata?.userId || payload.data.metadata?.external_id;
        const organizationId = payload.data.metadata?.referenceId;

        if (userId) {
          await handleUserCustomerStateChange(userId, payload);
        }

        if (organizationId) {
          await handleOrganizationCustomerStateChange(organizationId, payload);
        }
      },

      onBenefitGrantCreated: async (_payload) => {
        // Handle benefit grant creation - placeholder for future implementation
      },

      onBenefitGrantRevoked: async (_payload) => {
        // Handle benefit grant revocation - placeholder for future implementation
      },
    });

    // Handle the webhook request
    const result = await handleWebhookRequest(event, webhookHandlers);

    return { success: true, processed: result };
  } catch (error) {
    // Return 400 for client errors, 500 for server errors
    if (error instanceof Error && error.message.includes("Invalid signature")) {
      throw createError({
        statusCode: 401,
        statusMessage: "Invalid webhook signature",
      });
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Webhook processing failed",
    });
  }
});
