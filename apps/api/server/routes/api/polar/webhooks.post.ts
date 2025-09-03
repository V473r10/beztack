import { defineEventHandler, createError } from "h3";
import { handleWebhookRequest, createDefaultWebhookHandlers } from "@buncn/payments/server";
import { db } from "@/db/db";
import { schema } from "@/db/schema";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  try {
    // Create webhook handlers with organization-level membership management
    const webhookHandlers = createDefaultWebhookHandlers({
      onOrderPaid: async (payload) => {
        console.log('Order paid:', {
          orderId: payload.data.id,
          customerId: payload.data.customer_id,
          referenceId: payload.data.metadata?.referenceId, // This will be the organization ID
          amount: payload.data.amount,
          products: payload.data.products
        });

        // If this was an organization purchase (has referenceId), handle organization-level subscription
        if (payload.data.metadata?.referenceId) {
          const organizationId = payload.data.metadata.referenceId;
          
          // Update organization metadata with subscription info
          // This is where you would update subscription status in your database
          console.log(`Activating subscription for organization: ${organizationId}`);
        }
      },
      
      onSubscriptionActive: async (payload) => {
        console.log('Subscription activated:', {
          subscriptionId: payload.data.id,
          customerId: payload.data.customer_id,
          organizationId: payload.data.metadata?.referenceId,
          status: payload.data.status
        });

        // Handle organization-level subscription activation
        if (payload.data.metadata?.referenceId) {
          const organizationId = payload.data.metadata.referenceId;
          console.log(`Organization ${organizationId} subscription activated`);
          
          // You can update organization metadata or create subscription records here
        }
      },
      
      onSubscriptionCanceled: async (payload) => {
        console.log('Subscription canceled:', {
          subscriptionId: payload.data.id,
          customerId: payload.data.customer_id,
          organizationId: payload.data.metadata?.referenceId,
          status: payload.data.status
        });

        // Handle organization-level subscription cancellation
        if (payload.data.metadata?.referenceId) {
          const organizationId = payload.data.metadata.referenceId;
          console.log(`Organization ${organizationId} subscription canceled`);
        }
      },

      onCustomerStateChanged: async (payload) => {
        console.log('Customer state changed:', {
          customerId: payload.data.id,
          email: payload.data.email,
          subscriptions: payload.data.subscriptions,
          benefits: payload.data.benefits
        });

        // Update user/customer data in your database
        // Find user by Polar customer external_id (which should be our user ID)
        if (payload.data.metadata?.external_id) {
          const userId = payload.data.metadata.external_id;
          console.log(`Updating user ${userId} based on customer state change`);
        }
      },

      onBenefitGrantCreated: async (payload) => {
        console.log('Benefit grant created:', {
          benefitId: payload.data.benefit.id,
          customerId: payload.data.customer_id,
          organizationId: payload.data.properties?.organization_id,
          type: payload.data.benefit.type
        });
      },

      onBenefitGrantRevoked: async (payload) => {
        console.log('Benefit grant revoked:', {
          benefitId: payload.data.benefit.id,
          customerId: payload.data.customer_id,
          organizationId: payload.data.properties?.organization_id,
          type: payload.data.benefit.type
        });
      }
    });

    // Handle the webhook request
    const result = await handleWebhookRequest(event, webhookHandlers);
    
    return { success: true, processed: result };
  } catch (error) {
    console.error('Webhook processing error:', error);
    
    // Return 400 for client errors, 500 for server errors
    if (error instanceof Error && error.message.includes('Invalid signature')) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid webhook signature'
      });
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Webhook processing failed'
    });
  }
});