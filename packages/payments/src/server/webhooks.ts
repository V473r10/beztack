import crypto from "node:crypto";
import type { 
  Customer, 
  Order, 
  Subscription, 
  MembershipTier 
} from "../types/index.ts";

/**
 * Webhook signature verification
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(payload, "utf8")
      .digest("hex");

    const normalizedSignature = signature.startsWith("sha256=") 
      ? signature.slice(7) 
      : signature;

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, "hex"),
      Buffer.from(normalizedSignature, "hex")
    );
  } catch (error) {
    console.error("Error verifying webhook signature:", error);
    return false;
  }
}

/**
 * Webhook payload types from Polar
 */
export interface PolarWebhookPayload {
  type: string;
  data: {
    customer?: Customer;
    order?: Order;
    subscription?: Subscription;
    benefit_grant?: any;
    checkout?: any;
    [key: string]: any;
  };
}

/**
 * Membership update data
 */
export interface MembershipUpdate {
  userId: string;
  tier: MembershipTier;
  status: "active" | "inactive" | "canceled" | "past_due";
  subscriptionId?: string;
  organizationId?: string;
  validUntil?: Date;
}

/**
 * Webhook event handlers
 */
export class WebhookEventHandler {
  private membershipUpdateCallback?: (update: MembershipUpdate) => Promise<void>;
  private customHandlers: Map<string, (payload: any) => Promise<void>> = new Map();

  constructor(membershipUpdateCallback?: (update: MembershipUpdate) => Promise<void>) {
    this.membershipUpdateCallback = membershipUpdateCallback;
  }

  /**
   * Register custom event handler
   */
  on(eventType: string, handler: (payload: any) => Promise<void>) {
    this.customHandlers.set(eventType, handler);
  }

  /**
   * Handle webhook payload
   */
  async handle(payload: PolarWebhookPayload): Promise<void> {
    try {
      // Call custom handler if registered
      const customHandler = this.customHandlers.get(payload.type);
      if (customHandler) {
        await customHandler(payload.data);
      }

      // Handle membership-related events
      switch (payload.type) {
        case "order.paid":
          await this.handleOrderPaid(payload.data.order);
          break;
        case "subscription.active":
          await this.handleSubscriptionActive(payload.data.subscription);
          break;
        case "subscription.canceled":
          await this.handleSubscriptionCanceled(payload.data.subscription);
          break;
        case "subscription.revoked":
          await this.handleSubscriptionRevoked(payload.data.subscription);
          break;
        case "subscription.past_due":
          await this.handleSubscriptionPastDue(payload.data.subscription);
          break;
        case "customer.updated":
          await this.handleCustomerUpdated(payload.data.customer);
          break;
        default:
          console.log(`Unhandled webhook event: ${payload.type}`);
      }
    } catch (error) {
      console.error(`Error handling webhook ${payload.type}:`, error);
      throw error;
    }
  }

  /**
   * Handle paid order (one-time purchase)
   */
  private async handleOrderPaid(order?: Order): Promise<void> {
    if (!order?.metadata?.userId || !order.metadata.tier) {
      console.log("Order missing userId or tier metadata");
      return;
    }

    const update: MembershipUpdate = {
      userId: order.metadata.userId,
      tier: order.metadata.tier as MembershipTier,
      status: "active",
      organizationId: order.metadata.organizationId,
      // One-time purchases don't have expiration
    };

    await this.updateMembership(update);
  }

  /**
   * Handle active subscription
   */
  private async handleSubscriptionActive(subscription?: Subscription): Promise<void> {
    if (!subscription?.metadata?.userId || !subscription.metadata.tier) {
      console.log("Subscription missing userId or tier metadata");
      return;
    }

    const update: MembershipUpdate = {
      userId: subscription.metadata.userId,
      tier: subscription.metadata.tier as MembershipTier,
      status: "active",
      subscriptionId: subscription.id,
      organizationId: subscription.metadata.organizationId,
      validUntil: subscription.currentPeriodEnd,
    };

    await this.updateMembership(update);
  }

  /**
   * Handle canceled subscription
   */
  private async handleSubscriptionCanceled(subscription?: Subscription): Promise<void> {
    if (!subscription?.metadata?.userId) {
      console.log("Subscription missing userId metadata");
      return;
    }

    const update: MembershipUpdate = {
      userId: subscription.metadata.userId,
      tier: "free", // Downgrade to free tier
      status: "canceled",
      subscriptionId: subscription.id,
      organizationId: subscription.metadata.organizationId,
      validUntil: subscription.currentPeriodEnd, // Grace period until end of billing period
    };

    await this.updateMembership(update);
  }

  /**
   * Handle revoked subscription (immediate termination)
   */
  private async handleSubscriptionRevoked(subscription?: Subscription): Promise<void> {
    if (!subscription?.metadata?.userId) {
      console.log("Subscription missing userId metadata");
      return;
    }

    const update: MembershipUpdate = {
      userId: subscription.metadata.userId,
      tier: "free", // Immediate downgrade to free tier
      status: "inactive",
      subscriptionId: subscription.id,
      organizationId: subscription.metadata.organizationId,
      validUntil: new Date(), // Immediate termination
    };

    await this.updateMembership(update);
  }

  /**
   * Handle past due subscription
   */
  private async handleSubscriptionPastDue(subscription?: Subscription): Promise<void> {
    if (!subscription?.metadata?.userId || !subscription.metadata.tier) {
      console.log("Subscription missing userId or tier metadata");
      return;
    }

    const update: MembershipUpdate = {
      userId: subscription.metadata.userId,
      tier: subscription.metadata.tier as MembershipTier,
      status: "past_due",
      subscriptionId: subscription.id,
      organizationId: subscription.metadata.organizationId,
      validUntil: subscription.currentPeriodEnd,
    };

    await this.updateMembership(update);
  }

  /**
   * Handle customer updates
   */
  private async handleCustomerUpdated(customer?: Customer): Promise<void> {
    if (!customer?.metadata?.userId) {
      console.log("Customer missing userId metadata");
      return;
    }

    // This is mainly for informational purposes
    console.log(`Customer ${customer.id} updated for user ${customer.metadata.userId}`);
  }

  /**
   * Update membership in database
   */
  private async updateMembership(update: MembershipUpdate): Promise<void> {
    if (this.membershipUpdateCallback) {
      await this.membershipUpdateCallback(update);
    } else {
      console.log("Membership update:", update);
    }
  }
}

/**
 * Create webhook handler with database integration
 */
export function createWebhookHandler(
  membershipUpdateCallback?: (update: MembershipUpdate) => Promise<void>
): WebhookEventHandler {
  return new WebhookEventHandler(membershipUpdateCallback);
}

/**
 * Create default webhook handlers for common events
 */
export function createDefaultWebhookHandlers(customHandlers: Record<string, (payload: any) => Promise<void>> = {}): Record<string, (payload: any) => Promise<void>> {
  return {
    'order.paid': customHandlers.onOrderPaid || (async (payload) => {
      console.log('Order paid:', payload);
    }),
    'subscription.active': customHandlers.onSubscriptionActive || (async (payload) => {
      console.log('Subscription activated:', payload);
    }),
    'subscription.canceled': customHandlers.onSubscriptionCanceled || (async (payload) => {
      console.log('Subscription canceled:', payload);
    }),
    'subscription.revoked': customHandlers.onSubscriptionRevoked || (async (payload) => {
      console.log('Subscription revoked:', payload);
    }),
    'customer.updated': customHandlers.onCustomerStateChanged || (async (payload) => {
      console.log('Customer state changed:', payload);
    }),
    'benefit.grant.created': customHandlers.onBenefitGrantCreated || (async (payload) => {
      console.log('Benefit grant created:', payload);
    }),
    'benefit.grant.revoked': customHandlers.onBenefitGrantRevoked || (async (payload) => {
      console.log('Benefit grant revoked:', payload);
    }),
    // Add any custom handlers
    ...Object.fromEntries(
      Object.entries(customHandlers).filter(([key]) => !key.startsWith('on'))
    )
  };
}

/**
 * Nitro/h3 webhook endpoint helper
 */
export async function handleWebhookRequest(
  event: any, // H3Event type
  handlers: Record<string, (payload: any) => Promise<void>>
): Promise<{ success: boolean; error?: string }> {
  try {
    // Import h3 readBody function dynamically
    const { readBody, getHeader } = await import('h3');
    
    const body = await readBody(event);
    const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
    const signature = getHeader(event, "x-polar-signature") || "";

    const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return { success: false, error: "POLAR_WEBHOOK_SECRET not configured" };
    }

    // Verify webhook signature
    if (!verifyWebhookSignature(bodyString, signature, webhookSecret)) {
      return { success: false, error: "Invalid webhook signature" };
    }

    // Parse payload
    const payload: PolarWebhookPayload = typeof body === 'string' ? JSON.parse(body) : body;

    // Handle the event with registered handlers
    const handler = handlers[payload.type];
    if (handler) {
      await handler(payload.data);
    } else {
      console.log(`No handler registered for webhook event: ${payload.type}`);
    }

    return { success: true };
  } catch (error) {
    console.error("Webhook handling error:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}