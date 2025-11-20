import crypto from "node:crypto";
import type { Customer } from "@polar-sh/sdk/models/components/customer.js";
import type { Order } from "@polar-sh/sdk/models/components/order.js";
import type { Subscription } from "@polar-sh/sdk/models/components/subscription.js";
import type { EventHandlerRequest, H3Event } from "h3";
import type { MembershipTier } from "@/server/utils/membership";

const SHA256_PREFIX_LENGTH = 7;

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
      ? signature.slice(SHA256_PREFIX_LENGTH)
      : signature;

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, "hex"),
      Buffer.from(normalizedSignature, "hex")
    );
  } catch (_error) {
    return false;
  }
}

/**
 * Benefit grant data from Polar
 */
export type BenefitGrant = {
  id: string;
  type: string;
  benefit_id: string;
  user_id?: string;
  customer_id?: string;
  granted_at: string;
  revoked_at?: string;
  properties: Record<string, unknown>;
};

/**
 * Checkout data from Polar
 */
export type Checkout = {
  id: string;
  url?: string;
  product_id: string;
  product_price_id: string;
  amount?: number;
  tax_amount?: number;
  currency?: string;
  status: string;
  customer_id?: string;
  customer_email?: string;
  success_url?: string;
  created_at: string;
  expires_at?: string;
  metadata?: Record<string, string>;
};

/**
 * Generic webhook payload data
 */
export type WebhookPayloadData = {
  customer?: Customer;
  order?: Order;
  subscription?: Subscription;
  benefit_grant?: BenefitGrant;
  checkout?: Checkout;
  [key: string]: unknown;
};

/**
 * Webhook payload handler function type
 */
export type WebhookPayloadHandler = (
  payload: WebhookPayloadData
) => Promise<void>;

/**
 * Webhook payload types from Polar
 */
export type PolarWebhookPayload = {
  type: string;
  data: WebhookPayloadData;
};

/**
 * Membership update data
 */
export type MembershipUpdate = {
  userId: string;
  tier: MembershipTier;
  status: "active" | "inactive" | "canceled" | "past_due";
  subscriptionId?: string;
  organizationId?: string;
  validUntil?: Date;
};

/**
 * Webhook event handlers
 */
export class WebhookEventHandler {
  private readonly membershipUpdateCallback?: (
    update: MembershipUpdate
  ) => Promise<void>;
  private readonly customHandlers: Map<string, WebhookPayloadHandler> =
    new Map();

  constructor(
    membershipUpdateCallback?: (update: MembershipUpdate) => Promise<void>
  ) {
    this.membershipUpdateCallback = membershipUpdateCallback;
  }

  /**
   * Register custom event handler
   */
  on(eventType: string, handler: WebhookPayloadHandler) {
    this.customHandlers.set(eventType, handler);
  }

  /**
   * Handle webhook payload
   */
  async handle(payload: PolarWebhookPayload): Promise<void> {
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
    }
  }

  /**
   * Handle paid order (one-time purchase)
   */
  private async handleOrderPaid(order?: Order): Promise<void> {
    if (!(order?.metadata?.userId && order.metadata.tier)) {
      return;
    }

    const update: MembershipUpdate = {
      userId: order.metadata.userId.toString(),
      tier: order.metadata.tier as MembershipTier,
      status: "active",
      organizationId: order.metadata.organizationId?.toString(),
      // One-time purchases don't have expiration
    };

    await this.updateMembership(update);
  }

  /**
   * Handle active subscription
   */
  private async handleSubscriptionActive(
    subscription?: Subscription
  ): Promise<void> {
    if (!(subscription?.metadata?.userId && subscription.metadata.tier)) {
      return;
    }

    const update: MembershipUpdate = {
      userId: subscription.metadata.userId.toString(),
      tier: subscription.metadata.tier as MembershipTier,
      status: "active",
      subscriptionId: subscription.id,
      organizationId: subscription.metadata.organizationId?.toString(),
      validUntil: subscription.currentPeriodEnd
        ? new Date(subscription.currentPeriodEnd)
        : undefined,
    };

    await this.updateMembership(update);
  }

  /**
   * Handle canceled subscription
   */
  private async handleSubscriptionCanceled(
    subscription?: Subscription
  ): Promise<void> {
    if (!subscription?.metadata?.userId) {
      return;
    }

    const update: MembershipUpdate = {
      userId: subscription.metadata.userId.toString(),
      tier: "free", // Downgrade to free tier
      status: "canceled",
      subscriptionId: subscription.id,
      organizationId: subscription.metadata.organizationId?.toString(),
      validUntil: subscription.currentPeriodEnd
        ? new Date(subscription.currentPeriodEnd)
        : undefined, // Grace period until end of billing period
    };

    await this.updateMembership(update);
  }

  /**
   * Handle revoked subscription (immediate termination)
   */
  private async handleSubscriptionRevoked(
    subscription?: Subscription
  ): Promise<void> {
    if (!subscription?.metadata?.userId) {
      return;
    }

    const update: MembershipUpdate = {
      userId: subscription.metadata.userId.toString(),
      tier: "free", // Immediate downgrade to free tier
      status: "inactive",
      subscriptionId: subscription.id,
      organizationId: subscription.metadata.organizationId?.toString(),
      validUntil: new Date(), // Immediate termination
    };

    await this.updateMembership(update);
  }

  /**
   * Handle past due subscription
   */
  private async handleSubscriptionPastDue(
    subscription?: Subscription
  ): Promise<void> {
    if (!(subscription?.metadata?.userId && subscription.metadata.tier)) {
      return;
    }

    const update: MembershipUpdate = {
      userId: subscription.metadata.userId.toString(),
      tier: subscription.metadata.tier as MembershipTier,
      status: "past_due",
      subscriptionId: subscription.id,
      organizationId: subscription.metadata.organizationId?.toString(),
      validUntil: subscription.currentPeriodEnd
        ? new Date(subscription.currentPeriodEnd)
        : undefined,
    };

    await this.updateMembership(update);
  }

  /**
   * Handle customer updates
   */
  private handleCustomerUpdated(customer?: Customer): void {
    if (!customer?.metadata?.userId) {
      return;
    }
  }

  /**
   * Update membership in database
   */
  private async updateMembership(update: MembershipUpdate): Promise<void> {
    if (this.membershipUpdateCallback) {
      await this.membershipUpdateCallback(update);
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
export function createDefaultWebhookHandlers(
  customHandlers: Record<string, WebhookPayloadHandler> = {}
): Record<string, WebhookPayloadHandler> {
  return {
    "order.paid":
      customHandlers.onOrderPaid ||
      (async (_payload) => {
        // Default no-op handler
      }),
    "subscription.active":
      customHandlers.onSubscriptionActive ||
      (async (_payload) => {
        // Default no-op handler
      }),
    "subscription.canceled":
      customHandlers.onSubscriptionCanceled ||
      (async (_payload) => {
        // Default no-op handler
      }),
    "subscription.revoked":
      customHandlers.onSubscriptionRevoked ||
      (async (_payload) => {
        // Default no-op handler
      }),
    "customer.updated":
      customHandlers.onCustomerStateChanged ||
      (async (_payload) => {
        // Default no-op handler
      }),
    "benefit.grant.created":
      customHandlers.onBenefitGrantCreated ||
      (async (_payload) => {
        // Default no-op handler
      }),
    "benefit.grant.revoked":
      customHandlers.onBenefitGrantRevoked ||
      (async (_payload) => {
        // Default no-op handler
      }),
    // Add any custom handlers
    ...Object.fromEntries(
      Object.entries(customHandlers).filter(([key]) => !key.startsWith("on"))
    ),
  };
}

/**
 * Nitro/h3 webhook endpoint helper
 */
export async function handleWebhookRequest(
  event: {
    node: {
      req: {
        headers: Record<string, string | string[] | undefined>;
      };
    };
  },
  handlers: Record<string, WebhookPayloadHandler>
): Promise<{ success: boolean; error?: string }> {
  try {
    // Import h3 readBody function dynamically
    const { readBody, getHeader } = await import("h3");

    const body = await readBody(
      event as unknown as H3Event<EventHandlerRequest>
    );
    const bodyString = typeof body === "string" ? body : JSON.stringify(body);
    const signature =
      getHeader(
        event as unknown as H3Event<EventHandlerRequest>,
        "x-polar-signature"
      ) || "";

    const { env } = await import("@/env");
    const webhookSecret = env.POLAR_WEBHOOK_SECRET;

    // Verify webhook signature
    if (!verifyWebhookSignature(bodyString, signature, webhookSecret)) {
      return { success: false, error: "Invalid webhook signature" };
    }

    // Parse payload
    const payload: PolarWebhookPayload =
      typeof body === "string" ? JSON.parse(body) : body;

    // Handle the event with registered handlers
    const handler = handlers[payload.type];
    if (handler) {
      await handler(payload.data);
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
