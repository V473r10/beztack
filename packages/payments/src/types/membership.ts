import type { z } from "zod";

/**
 * Membership tier levels based on VIT-17 strategy
 */
export type MembershipTier = "free" | "pro" | "team" | "enterprise";

/**
 * Membership tier configuration
 */
export interface MembershipTierConfig {
  readonly id: MembershipTier;
  readonly name: string;
  readonly description: string;
  readonly price: {
    readonly monthly: number;
    readonly yearly: number;
  };
  readonly features: readonly string[];
  readonly permissions: readonly string[];
  readonly limits: {
    readonly users?: number;
    readonly organizations?: number;
    readonly teams?: number;
    readonly storage?: number; // in GB
    readonly apiCalls?: number; // per month
  };
  readonly polarProductId?: string;
}

/**
 * User membership status
 */
export interface UserMembership {
  readonly userId: string;
  readonly tier: MembershipTier;
  readonly status: "active" | "inactive" | "canceled" | "past_due";
  readonly subscriptionId?: string;
  readonly customerId?: string;
  readonly organizationId?: string; // For team/enterprise tiers
  readonly validUntil?: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Membership upgrade/downgrade request
 */
export interface MembershipChangeRequest {
  readonly userId: string;
  readonly fromTier: MembershipTier;
  readonly toTier: MembershipTier;
  readonly billingPeriod: "monthly" | "yearly";
  readonly organizationId?: string;
  readonly prorationBehavior?: "create_prorations" | "none";
}

/**
 * Membership validation result
 */
export interface MembershipValidationResult {
  readonly isValid: boolean;
  readonly tier: MembershipTier;
  readonly permissions: readonly string[];
  readonly limits: MembershipTierConfig["limits"];
  readonly features: readonly string[];
  readonly expiresAt?: Date;
  readonly error?: string;
}

/**
 * Usage tracking for metered features
 */
export interface UsageMetrics {
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
}