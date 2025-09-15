export { useBillingPortal, useCheckout, useCustomerBenefits, useCustomerMeters, useCustomerOrders, useCustomerState, useCustomerSubscriptions, useMembershipTier, useOrganizationSubscription, useSubscriptionManagement, useUsageTracking, } from "./hooks.ts";
/**
 * Client-side utilities for checkout and billing
 */
/**
 * Generate checkout URL for a specific tier
 */
export declare function getCheckoutUrl(tier: string, options?: {
    organizationId?: string;
    successUrl?: string;
    cancelUrl?: string;
}): string;
/**
 * Generate billing portal URL
 */
export declare function getBillingPortalUrl(returnUrl?: string): string;
/**
 * Format currency amount for display
 */
export declare function formatCurrency(amount: number, currency?: string, locale?: string): string;
/**
 * Calculate savings for yearly billing
 */
export declare function calculateYearlySavings(monthlyPrice: number, yearlyPrice: number): {
    amount: number;
    percentage: number;
    formattedAmount: string;
    formattedPercentage: string;
};
/**
 * Check if subscription is in grace period
 */
export declare function isSubscriptionInGracePeriod(subscription: {
    status: string;
    currentPeriodEnd: Date;
    canceledAt?: Date;
}): boolean;
/**
 * Get subscription renewal date
 */
export declare function getSubscriptionRenewalDate(subscription: {
    currentPeriodEnd: Date;
    status: string;
}): Date | null;
/**
 * Check if customer has specific benefit
 */
export declare function hasBenefit(benefits: Array<{
    type: string;
    isGranted: boolean;
}>, benefitType: string): boolean;
/**
 * Get usage percentage for a meter
 */
export declare function getUsagePercentage(meter: {
    currentBalance: number;
    consumedUnits: number;
}, limit?: number): number | null;
/**
 * Check if usage is approaching limit
 */
export declare function isUsageNearLimit(meter: {
    currentBalance: number;
    consumedUnits: number;
}, limit?: number, warningThreshold?: number): boolean;
