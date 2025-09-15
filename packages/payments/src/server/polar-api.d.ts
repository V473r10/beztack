import { Polar } from "@polar-sh/sdk";
/**
 * Direct Polar API integration
 * Provides methods for interacting with Polar's API beyond what Better Auth plugins offer
 */
type PolarOrganization = {
    id: string;
    name: string;
    slug: string;
    created_at: string;
    updated_at: string;
};
type PolarProduct = {
    id: string;
    name: string;
    description?: string;
    organization_id: string;
    created_at: string;
    updated_at: string;
};
type PolarCustomer = {
    id: string;
    email: string;
    name?: string;
    metadata?: Record<string, unknown>;
    created_at: string;
    updated_at: string;
};
type PolarSubscription = {
    id: string;
    customer_id: string;
    product_id: string;
    status: string;
    current_period_start: string;
    current_period_end: string;
    created_at: string;
    updated_at: string;
};
type PolarCheckout = {
    id: string;
    url: string;
    status: string;
    product_id?: string;
    customer_id?: string;
    created_at: string;
    updated_at: string;
};
type CustomerCreateData = {
    email: string;
    name?: string;
    metadata?: Record<string, unknown>;
};
type CustomerUpdateData = {
    name?: string;
    email?: string;
    metadata?: Record<string, unknown>;
};
type CheckoutCreateData = {
    product_id?: string;
    product_price_id?: string;
    customer_id?: string;
    success_url?: string;
    cancel_url?: string;
    metadata?: Record<string, unknown>;
};
/**
 * Create configured Polar client
 */
export declare function createPolarClient(config?: {
    accessToken?: string;
    server?: "production" | "sandbox";
}): Polar;
/**
 * Polar API service class
 */
export declare class PolarApiService {
    private readonly client;
    constructor(config?: {
        accessToken?: string;
        server?: "production" | "sandbox";
    });
    /**
     * Get organization information
     */
    getOrganization(orgId: string): Promise<PolarOrganization>;
    /**
     * List all products for an organization
     */
    getProducts(orgId: string): Promise<PolarProduct[]>;
    /**
     * Get specific product by ID
     */
    getProduct(productId: string): Promise<PolarProduct>;
    /**
     * Create a customer
     */
    createCustomer(data: CustomerCreateData): Promise<PolarCustomer>;
    /**
     * Get customer by ID
     */
    getCustomer(customerId: string): Promise<PolarCustomer>;
    /**
     * Update customer
     */
    updateCustomer(customerId: string, data: CustomerUpdateData): Promise<PolarCustomer>;
    /**
     * List customer subscriptions
     */
    getCustomerSubscriptions(customerId: string): Promise<PolarSubscription[]>;
    /**
     * Create a checkout session
     */
    createCheckout(data: CheckoutCreateData): Promise<PolarCheckout>;
    /**
     * Get checkout session
     */
    getCheckout(checkoutId: string): Promise<PolarCheckout>;
    /**
     * Create custom checkout link for a product
     */
    createProductCheckout(data: {
        productId: string;
        customerId?: string;
        customerEmail?: string;
        successUrl?: string;
        metadata?: Record<string, unknown>;
    }): Promise<PolarCheckout>;
    /**
     * Get customer benefits/entitlements
     */
    getCustomerBenefits(customerId: string): Promise<{
        customer: PolarCustomer;
        subscriptions: PolarSubscription[];
    }>;
}
/**
 * Default Polar API service instance
 */
export declare const polarApi: PolarApiService;
/**
 * Utility functions for common operations
 */
export declare function validatePolarConnection(): Promise<boolean>;
/**
 * Get organization products with tier mapping
 */
export declare function getOrganizationProducts(orgId: string): Promise<{
    tier: string;
    id: string;
    name: string;
    description?: string;
    organization_id: string;
    created_at: string;
    updated_at: string;
}[]>;
export {};
