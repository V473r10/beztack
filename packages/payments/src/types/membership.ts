/**
 * Polar product object type
 */
type PolarProduct = {
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
export type MembershipTier = "free" | "pro" | "team" | "enterprise";

/**
 * Membership tier configuration from Polar API
 */
export type MembershipTierConfig = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly price: {
    readonly monthly: number;
    readonly yearly: number;
  };
  readonly monthly?: PolarProduct; // Full Polar product object for monthly billing
  readonly yearly?: PolarProduct; // Full Polar product object for yearly billing
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
  readonly organizationId?: string; // For team/enterprise tiers
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
