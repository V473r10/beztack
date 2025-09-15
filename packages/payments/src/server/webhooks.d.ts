import type { Customer, MembershipTier, Order, Subscription } from "../types/index.ts";
/**
 * Webhook signature verification
 */
export declare function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean;
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
export type WebhookPayloadHandler = (payload: WebhookPayloadData) => Promise<void>;
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
export declare class WebhookEventHandler {
    private readonly membershipUpdateCallback?;
    private readonly customHandlers;
    constructor(membershipUpdateCallback?: (update: MembershipUpdate) => Promise<void>);
    /**
     * Register custom event handler
     */
    on(eventType: string, handler: WebhookPayloadHandler): void;
    /**
     * Handle webhook payload
     */
    handle(payload: PolarWebhookPayload): Promise<void>;
    /**
     * Handle paid order (one-time purchase)
     */
    private handleOrderPaid;
    /**
     * Handle active subscription
     */
    private handleSubscriptionActive;
    /**
     * Handle canceled subscription
     */
    private handleSubscriptionCanceled;
    /**
     * Handle revoked subscription (immediate termination)
     */
    private handleSubscriptionRevoked;
    /**
     * Handle past due subscription
     */
    private handleSubscriptionPastDue;
    /**
     * Handle customer updates
     */
    private handleCustomerUpdated;
    /**
     * Update membership in database
     */
    private updateMembership;
}
/**
 * Create webhook handler with database integration
 */
export declare function createWebhookHandler(membershipUpdateCallback?: (update: MembershipUpdate) => Promise<void>): WebhookEventHandler;
/**
 * Create default webhook handlers for common events
 */
export declare function createDefaultWebhookHandlers(customHandlers?: Record<string, WebhookPayloadHandler>): Record<string, WebhookPayloadHandler>;
/**
 * Nitro/h3 webhook endpoint helper
 */
export declare function handleWebhookRequest(event: {
    node: {
        req: {
            headers: Record<string, string | string[] | undefined>;
        };
    };
}, handlers: Record<string, WebhookPayloadHandler>): Promise<{
    success: boolean;
    error?: string;
}>;
