import type { MembershipTier } from "./membership.ts";
/**
 * Customer data from Polar
 */
export type Customer = {
    readonly id: string;
    readonly externalId?: string;
    readonly email: string;
    readonly name?: string;
    readonly metadata?: {
        readonly userId?: string;
        readonly organizationId?: string;
    };
    readonly createdAt: Date;
    readonly updatedAt: Date;
};
/**
 * Order status from Polar
 */
export type OrderStatus = "pending" | "processing" | "completed" | "canceled" | "refunded";
/**
 * Order data from Polar
 */
export type Order = {
    readonly id: string;
    readonly customerId: string;
    readonly productId: string;
    readonly priceId: string;
    readonly status: OrderStatus;
    readonly amount: number;
    readonly currency: string;
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
 * Invoice data from Polar
 */
export type Invoice = {
    readonly id: string;
    readonly customerId: string;
    readonly subscriptionId?: string;
    readonly amount: number;
    readonly currency: string;
    readonly status: "draft" | "open" | "paid" | "void" | "uncollectible";
    readonly dueDate?: Date;
    readonly paidAt?: Date;
    readonly hostedInvoiceUrl?: string;
    readonly invoicePdf?: string;
    readonly metadata?: Record<string, string>;
    readonly createdAt: Date;
    readonly updatedAt: Date;
};
/**
 * Payment method data
 */
export type PaymentMethod = {
    readonly id: string;
    readonly customerId: string;
    readonly type: "card" | "bank_account";
    readonly card?: {
        readonly brand: string;
        readonly last4: string;
        readonly expMonth: number;
        readonly expYear: number;
    };
    readonly bankAccount?: {
        readonly routingNumber: string;
        readonly last4: string;
        readonly bankName: string;
    };
    readonly isDefault: boolean;
    readonly createdAt: Date;
};
/**
 * Checkout session parameters
 */
export type CheckoutSessionParams = {
    readonly productIds?: readonly string[];
    readonly slug?: string;
    readonly metadata?: {
        readonly userId?: string;
        readonly organizationId?: string;
        readonly tier?: MembershipTier;
        readonly referenceId?: string;
    };
    readonly successUrl?: string;
    readonly cancelUrl?: string;
    readonly allowPromotionCodes?: boolean;
};
/**
 * Checkout session data
 */
export type CheckoutSession = {
    readonly id: string;
    readonly url: string;
    readonly customerId?: string;
    readonly status: "open" | "complete" | "expired";
    readonly metadata?: CheckoutSessionParams["metadata"];
    readonly createdAt: Date;
    readonly expiresAt: Date;
};
/**
 * Billing portal session
 */
export type BillingPortalSession = {
    readonly id: string;
    readonly customerId: string;
    readonly url: string;
    readonly returnUrl?: string;
    readonly createdAt: Date;
    readonly expiresAt: Date;
};
/**
 * Usage event for metered billing
 */
export type UsageEvent = {
    readonly eventName: string;
    readonly customerId: string;
    readonly timestamp: Date;
    readonly quantity: number;
    readonly metadata?: {
        readonly userId?: string;
        readonly organizationId?: string;
        readonly feature?: string;
    };
};
/**
 * Customer portal state from Polar
 */
export type CustomerPortalState = {
    readonly customer: Customer;
    readonly subscriptions: readonly Subscription[];
    readonly benefits: readonly Benefit[];
    readonly meters: readonly CustomerMeter[];
};
/**
 * Benefit data from Polar
 */
export type Benefit = {
    readonly id: string;
    readonly type: string;
    readonly description: string;
    readonly isGranted: boolean;
    readonly grantedAt?: Date;
    readonly properties?: Record<string, unknown>;
};
/**
 * Customer meter for usage-based billing
 */
export type CustomerMeter = {
    readonly id: string;
    readonly customerId: string;
    readonly meterName: string;
    readonly currentBalance: number;
    readonly consumedUnits: number;
    readonly creditedUnits: number;
    readonly lastResetAt?: Date;
    readonly nextResetAt?: Date;
};
import type { Subscription } from "./subscription.ts";
