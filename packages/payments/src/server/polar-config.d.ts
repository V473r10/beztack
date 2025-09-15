import { Polar } from "@polar-sh/sdk";
/**
 * Webhook payload types for better type safety
 */
export type WebhookPayload = {
    type: string;
    id: string;
    created_at: string;
};
export interface CustomerStateChangedPayload extends WebhookPayload {
    customer: {
        id: string;
        email: string;
        name?: string;
    };
}
export interface OrderPayload extends WebhookPayload {
    order: {
        id: string;
        status: string;
        amount: number;
        currency: string;
    };
}
export interface SubscriptionPayload extends WebhookPayload {
    subscription: {
        id: string;
        status: string;
        product_id: string;
        customer_id: string;
    };
}
export interface CheckoutPayload extends WebhookPayload {
    checkout: {
        id: string;
        status: string;
        product_id: string;
    };
}
export interface BenefitGrantPayload extends WebhookPayload {
    benefit_grant: {
        id: string;
        customer_id: string;
        benefit_id: string;
    };
}
/**
 * Polar client configuration
 */
export type PolarClientConfig = {
    accessToken: string;
    server?: "production" | "sandbox";
};
/**
 * Create Polar SDK client
 */
export declare function createPolarClient(config: PolarClientConfig): Polar;
/**
 * Webhook handlers configuration
 */
export type WebhookHandlers = {
    onCustomerStateChanged?: (payload: CustomerStateChangedPayload) => Promise<void>;
    onOrderPaid?: (payload: OrderPayload) => Promise<void>;
    onSubscriptionCreated?: (payload: SubscriptionPayload) => Promise<void>;
    onSubscriptionUpdated?: (payload: SubscriptionPayload) => Promise<void>;
    onSubscriptionActive?: (payload: SubscriptionPayload) => Promise<void>;
    onSubscriptionCanceled?: (payload: SubscriptionPayload) => Promise<void>;
    onSubscriptionRevoked?: (payload: SubscriptionPayload) => Promise<void>;
    onCheckoutCreated?: (payload: CheckoutPayload) => Promise<void>;
    onCheckoutUpdated?: (payload: CheckoutPayload) => Promise<void>;
    onBenefitGrantCreated?: (payload: BenefitGrantPayload) => Promise<void>;
    onBenefitGrantUpdated?: (payload: BenefitGrantPayload) => Promise<void>;
    onBenefitGrantRevoked?: (payload: BenefitGrantPayload) => Promise<void>;
    onPayload?: (payload: WebhookPayload) => Promise<void>;
};
/**
 * Polar plugin configuration
 */
export type PolarPluginConfig = {
    client: Polar;
    createCustomerOnSignUp?: boolean;
    getCustomerCreateParams?: (data: {
        user: {
            id: string;
            email: string;
            emailVerified: boolean;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            image?: string | null;
        };
    }, request?: Request) => Promise<{
        metadata?: Record<string, string | number | boolean>;
    }>;
    webhookSecret?: string;
    webhookHandlers?: WebhookHandlers;
    successUrl?: string;
    cancelUrl?: string;
    authenticatedUsersOnly?: boolean;
};
/**
 * Create Polar Better Auth plugin with full configuration
 * Note: Products should be provided via config since tiers are now dynamic
 */
export declare function createPolarPlugin(config: PolarPluginConfig & {
    products?: Array<{
        productId: string;
        slug: string;
    }>;
}): any;
/**
 * Environment configuration helper
 */
export declare function getPolarConfigFromEnv(): PolarClientConfig;
/**
 * Complete Polar setup for Better Auth
 */
export declare function setupPolarForBetterAuth(customHandlers?: Partial<WebhookHandlers>): any;
