import type { MembershipTier } from "./membership.ts";
/**
 * Subscription status from Polar
 */
export type SubscriptionStatus = "incomplete" | "incomplete_expired" | "trialing" | "active" | "past_due" | "canceled" | "unpaid";
/**
 * Billing period
 */
export type BillingPeriod = "monthly" | "yearly";
/**
 * Subscription data from Polar
 */
export type Subscription = {
    readonly id: string;
    readonly customerId: string;
    readonly productId: string;
    readonly priceId: string;
    readonly status: SubscriptionStatus;
    readonly currentPeriodStart: Date;
    readonly currentPeriodEnd: Date;
    readonly cancelAtPeriodEnd: boolean;
    readonly canceledAt?: Date;
    readonly trialStart?: Date;
    readonly trialEnd?: Date;
    readonly metadata: {
        readonly userId?: string;
        readonly organizationId?: string;
        readonly tier?: MembershipTier;
        readonly referenceId?: string;
    };
    readonly createdAt: Date;
    readonly updatedAt: Date;
};
/**
 * Subscription with associated tier information
 */
export interface SubscriptionWithTier extends Subscription {
    readonly tier: MembershipTier;
    readonly billingPeriod: BillingPeriod;
}
/**
 * Subscription creation parameters
 */
export type CreateSubscriptionParams = {
    readonly customerId: string;
    readonly productId: string;
    readonly priceId: string;
    readonly metadata?: {
        readonly userId?: string;
        readonly organizationId?: string;
        readonly tier?: MembershipTier;
        readonly referenceId?: string;
    };
    readonly trialPeriodDays?: number;
};
/**
 * Subscription update parameters
 */
export type UpdateSubscriptionParams = {
    readonly subscriptionId: string;
    readonly priceId?: string;
    readonly metadata?: Subscription["metadata"];
    readonly cancelAtPeriodEnd?: boolean;
    readonly prorationBehavior?: "create_prorations" | "none";
};
/**
 * Subscription cancellation parameters
 */
export type CancelSubscriptionParams = {
    readonly subscriptionId: string;
    readonly cancelAtPeriodEnd: boolean;
    readonly cancellationReason?: string;
};
/**
 * Subscription preview for upgrades/downgrades
 */
export type SubscriptionPreview = {
    readonly subscriptionId: string;
    readonly currentPriceId: string;
    readonly newPriceId: string;
    readonly prorationDate: Date;
    readonly prorationAmount: number;
    readonly nextInvoiceAmount: number;
    readonly nextInvoiceDate: Date;
};
