/**
 * Provider product object type (provider-agnostic)
 */
type PaymentProduct = {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  billing_period?: string;
  [key: string]: unknown;
};

/**
 * Membership tier levels based on VIT-17 strategy
 */
export type MembershipTier = "free" | "basic" | "pro" | "ultimate";

/**
 * Membership tier configuration from Polar API
 */
export type MembershipTierConfig = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** Integer minor units of `currency` (ADR 0007): 900 is US$ 9.00. */
  readonly price: {
    readonly monthly: number;
    readonly yearly: number;
  };
  /** ISO 4217 code of `price`; unset while the tier has no priced plan. */
  readonly currency?: string;
  readonly monthly?: PaymentProduct;
  readonly yearly?: PaymentProduct;
  readonly features: string[];
  readonly limits: Record<string, number>;
  readonly permissions: string[];
};

/**
 * User membership status
 */
export type UserMembership = {
  readonly userId: string;
  readonly tier: MembershipTier;
  readonly status: "active" | "inactive" | "canceled" | "past_due";
  readonly subscriptionId?: string;
  readonly customerId?: string;
  readonly organizationId?: string; // For basic/ultimate tiers
  readonly validUntil?: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

/**
 * Membership upgrade/downgrade request
 */
export type MembershipChangeRequest = {
  readonly userId: string;
  readonly fromTier: MembershipTier;
  readonly toTier: MembershipTier;
  readonly billingPeriod: "monthly" | "yearly";
  readonly organizationId?: string;
  readonly prorationBehavior?: "create_prorations" | "none";
};

/**
 * Membership validation result
 */
export type MembershipValidationResult = {
  readonly isValid: boolean;
  readonly tier: MembershipTier;
  readonly permissions: readonly string[];
  readonly limits: MembershipTierConfig["limits"];
  readonly features: readonly string[];
  readonly expiresAt?: Date;
  readonly error?: string;
};

/**
 * Usage tracking for metered features
 */
export type UsageMetrics = {
  readonly userId: string;
  readonly organizationId?: string;
  readonly period: {
    readonly start: Date;
    readonly end: Date;
  };
  readonly metrics: {
    readonly apiCalls: number;
    readonly storageUsed: number; // in GB
    readonly activeUsers: number;
    readonly organizations: number;
    readonly teams: number;
  };
};
