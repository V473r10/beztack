import { z } from "zod";
import type { BillingPeriod, CheckoutSessionParams, MembershipTier, UsageEvent } from "../types/index.ts";
/**
 * Membership tier validation schema
 */
export declare const membershipTierSchema: z.ZodEnum<{
    free: "free";
    pro: "pro";
    team: "team";
    enterprise: "enterprise";
}>;
/**
 * Billing period validation schema
 */
export declare const billingPeriodSchema: z.ZodEnum<{
    monthly: "monthly";
    yearly: "yearly";
}>;
/**
 * Checkout session params validation schema
 */
export declare const checkoutSessionParamsSchema: z.ZodObject<{
    productIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    slug: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodObject<{
        userId: z.ZodOptional<z.ZodString>;
        organizationId: z.ZodOptional<z.ZodString>;
        tier: z.ZodOptional<z.ZodEnum<{
            free: "free";
            pro: "pro";
            team: "team";
            enterprise: "enterprise";
        }>>;
        referenceId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    successUrl: z.ZodOptional<z.ZodString>;
    cancelUrl: z.ZodOptional<z.ZodString>;
    allowPromotionCodes: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
/**
 * Usage event validation schema
 */
export declare const usageEventSchema: z.ZodObject<{
    eventName: z.ZodString;
    customerId: z.ZodString;
    timestamp: z.ZodDate;
    quantity: z.ZodNumber;
    metadata: z.ZodOptional<z.ZodObject<{
        userId: z.ZodOptional<z.ZodString>;
        organizationId: z.ZodOptional<z.ZodString>;
        feature: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
/**
 * Membership change request validation schema
 */
export declare const membershipChangeRequestSchema: z.ZodObject<{
    userId: z.ZodString;
    fromTier: z.ZodEnum<{
        free: "free";
        pro: "pro";
        team: "team";
        enterprise: "enterprise";
    }>;
    toTier: z.ZodEnum<{
        free: "free";
        pro: "pro";
        team: "team";
        enterprise: "enterprise";
    }>;
    billingPeriod: z.ZodEnum<{
        monthly: "monthly";
        yearly: "yearly";
    }>;
    organizationId: z.ZodOptional<z.ZodString>;
    prorationBehavior: z.ZodOptional<z.ZodEnum<{
        create_prorations: "create_prorations";
        none: "none";
    }>>;
}, z.core.$strip>;
/**
 * User membership validation schema
 */
export declare const userMembershipSchema: z.ZodObject<{
    userId: z.ZodString;
    tier: z.ZodEnum<{
        free: "free";
        pro: "pro";
        team: "team";
        enterprise: "enterprise";
    }>;
    status: z.ZodEnum<{
        active: "active";
        past_due: "past_due";
        canceled: "canceled";
        inactive: "inactive";
    }>;
    subscriptionId: z.ZodOptional<z.ZodString>;
    customerId: z.ZodOptional<z.ZodString>;
    organizationId: z.ZodOptional<z.ZodString>;
    validUntil: z.ZodOptional<z.ZodDate>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, z.core.$strip>;
/**
 * Usage metrics validation schema
 */
export declare const usageMetricsSchema: z.ZodObject<{
    userId: z.ZodString;
    organizationId: z.ZodOptional<z.ZodString>;
    period: z.ZodObject<{
        start: z.ZodDate;
        end: z.ZodDate;
    }, z.core.$strip>;
    metrics: z.ZodObject<{
        apiCalls: z.ZodNumber;
        storageUsed: z.ZodNumber;
        activeUsers: z.ZodNumber;
        organizations: z.ZodNumber;
        teams: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
/**
 * Webhook payload validation schema
 */
export declare const webhookPayloadSchema: z.ZodObject<{
    type: z.ZodString;
    data: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, z.core.$strip>;
/**
 * Validate membership tier
 */
export declare function validateMembershipTier(tier: unknown): MembershipTier;
/**
 * Validate billing period
 */
export declare function validateBillingPeriod(period: unknown): BillingPeriod;
/**
 * Validate checkout session parameters
 */
export declare function validateCheckoutSessionParams(params: unknown): CheckoutSessionParams;
/**
 * Validate usage event
 */
export declare function validateUsageEvent(event: unknown): UsageEvent;
/**
 * Validate tier upgrade/downgrade
 */
export declare function validateTierChange(fromTier: MembershipTier, toTier: MembershipTier): {
    isValid: boolean;
    changeType: "upgrade" | "downgrade" | "same";
    error?: string;
};
/**
 * Validate usage event name
 */
export declare function validateUsageEventName(eventName: string): boolean;
/**
 * Validate organization ID format
 */
export declare function validateOrganizationId(organizationId: string): boolean;
/**
 * Validate user ID format
 */
export declare function validateUserId(userId: string): boolean;
/**
 * Validate email format
 */
export declare function validateEmail(email: string): boolean;
/**
 * Validate webhook signature format
 */
export declare function validateWebhookSignature(signature: string): boolean;
/**
 * Sanitize metadata object
 */
export declare function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, string>;
/**
 * Validate API response structure
 */
export declare function validateApiResponse<T>(response: unknown, schema: z.ZodSchema<T>): {
    success: true;
    data: T;
} | {
    success: false;
    error: string;
};
