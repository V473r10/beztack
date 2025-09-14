import {
  createDefaultWebhookHandlers,
  handleWebhookRequest,
} from "@nvn/payments/server";
import { eq } from "drizzle-orm";
import { createError, defineEventHandler } from "h3";
import { db } from "@/db/db";
import { schema } from "@/db/schema";

export default defineEventHandler(async (event) => {
  try {
    // Create webhook handlers with proper database integration
    const webhookHandlers = createDefaultWebhookHandlers({
      onOrderPaid: async (payload) => {
        // Handle organization-level subscription
        if (payload.data.metadata?.referenceId) {
          const organizationId = payload.data.metadata.referenceId;
          const tierName = payload.data.metadata?.tier || "pro";

          try {
            await db
              .update(schema.organization)
              .set({
                subscriptionTier: tierName,
                subscriptionStatus: "active",
                polarCustomerId: payload.data.customer_id,
                subscriptionValidUntil: new Date(
                  Date.now() + 30 * 24 * 60 * 60 * 1000
                ), // 30 days default
                updatedAt: new Date(),
              })
              .where(eq(schema.organization.id, organizationId));
          } catch (_error) {}
        }

        // Handle individual user subscription
        if (payload.data.metadata?.userId) {
          const userId = payload.data.metadata.userId;
          const tierName = payload.data.metadata?.tier || "pro";

          try {
            await db
              .update(schema.user)
              .set({
                subscriptionTier: tierName,
                subscriptionStatus: "active",
                polarCustomerId: payload.data.customer_id,
                subscriptionValidUntil: new Date(
                  Date.now() + 30 * 24 * 60 * 60 * 1000
                ), // 30 days default
                updatedAt: new Date(),
              })
              .where(eq(schema.user.id, userId));
          } catch (_error) {}
        }
      },

      onSubscriptionActive: async (payload) => {
        // Handle organization-level subscription activation
        if (payload.data.metadata?.referenceId) {
          const organizationId = payload.data.metadata.referenceId;
          const tierName = payload.data.metadata?.tier || "pro";

          try {
            await db
              .update(schema.organization)
              .set({
                subscriptionTier: tierName,
                subscriptionStatus: "active",
                subscriptionId: payload.data.id,
                polarCustomerId: payload.data.customer_id,
                subscriptionValidUntil: payload.data.current_period_end
                  ? new Date(payload.data.current_period_end)
                  : null,
                updatedAt: new Date(),
              })
              .where(eq(schema.organization.id, organizationId));
          } catch (_error) {}
        }

        // Handle individual user subscription activation
        if (payload.data.metadata?.userId) {
          const userId = payload.data.metadata.userId;
          const tierName = payload.data.metadata?.tier || "pro";

          try {
            await db
              .update(schema.user)
              .set({
                subscriptionTier: tierName,
                subscriptionStatus: "active",
                subscriptionId: payload.data.id,
                polarCustomerId: payload.data.customer_id,
                subscriptionValidUntil: payload.data.current_period_end
                  ? new Date(payload.data.current_period_end)
                  : null,
                updatedAt: new Date(),
              })
              .where(eq(schema.user.id, userId));
          } catch (_error) {}
        }
      },

      onSubscriptionCanceled: async (payload) => {
        // Handle organization-level subscription cancellation
        if (payload.data.metadata?.referenceId) {
          const organizationId = payload.data.metadata.referenceId;

          try {
            await db
              .update(schema.organization)
              .set({
                subscriptionStatus: "canceled",
                // Keep tier active until period end, then it will expire
                subscriptionValidUntil: payload.data.current_period_end
                  ? new Date(payload.data.current_period_end)
                  : new Date(),
                updatedAt: new Date(),
              })
              .where(eq(schema.organization.id, organizationId));
          } catch (_error) {}
        }

        // Handle individual user subscription cancellation
        if (payload.data.metadata?.userId) {
          const userId = payload.data.metadata.userId;

          try {
            await db
              .update(schema.user)
              .set({
                subscriptionStatus: "canceled",
                // Keep tier active until period end, then it will expire
                subscriptionValidUntil: payload.data.current_period_end
                  ? new Date(payload.data.current_period_end)
                  : new Date(),
                updatedAt: new Date(),
              })
              .where(eq(schema.user.id, userId));
          } catch (_error) {}
        }
      },

      onCustomerStateChanged: async (payload) => {
        // Update user/customer data in database
        // Find user by Polar customer metadata (userId or external_id)
        const userId =
          payload.data.metadata?.userId || payload.data.metadata?.external_id;
        const organizationId = payload.data.metadata?.referenceId;

        if (userId) {
          try {
            // Update user's Polar customer ID if not already set
            const updates: any = {
              polarCustomerId: payload.data.id,
              updatedAt: new Date(),
            };

            // If customer has active subscriptions, update tier info
            const activeSubscription = payload.data.subscriptions?.find(
              (sub: any) => sub.status === "active"
            );
            if (activeSubscription) {
              updates.subscriptionTier =
                activeSubscription.metadata?.tier || "pro";
              updates.subscriptionStatus = "active";
              updates.subscriptionId = activeSubscription.id;
              updates.subscriptionValidUntil =
                activeSubscription.current_period_end
                  ? new Date(activeSubscription.current_period_end)
                  : null;
            }

            await db
              .update(schema.user)
              .set(updates)
              .where(eq(schema.user.id, userId));
          } catch (_error) {}
        }

        if (organizationId) {
          try {
            // Update organization's Polar customer ID if not already set
            const updates: any = {
              polarCustomerId: payload.data.id,
              updatedAt: new Date(),
            };

            // If customer has active subscriptions, update tier info
            const activeSubscription = payload.data.subscriptions?.find(
              (sub: any) => sub.status === "active"
            );
            if (activeSubscription) {
              updates.subscriptionTier =
                activeSubscription.metadata?.tier || "team";
              updates.subscriptionStatus = "active";
              updates.subscriptionId = activeSubscription.id;
              updates.subscriptionValidUntil =
                activeSubscription.current_period_end
                  ? new Date(activeSubscription.current_period_end)
                  : null;
            }

            await db
              .update(schema.organization)
              .set(updates)
              .where(eq(schema.organization.id, organizationId));
          } catch (_error) {}
        }
      },

      onBenefitGrantCreated: async (_payload) => {},

      onBenefitGrantRevoked: async (_payload) => {},
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
