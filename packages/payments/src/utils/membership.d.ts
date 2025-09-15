import type { CustomerPortalState, MembershipTier, MembershipValidationResult, UsageMetrics, UserMembership } from "../types/index.ts";
/**
 * Validate user membership based on customer portal state
 * Note: This function now returns basic validation - full tier details should be fetched from API
 */
export declare function validateMembership(state: CustomerPortalState): MembershipValidationResult;
/**
 * Check if user has specific permission
 */
export declare function hasPermission(membership: MembershipValidationResult, permission: string): boolean;
/**
 * Check if user has any of the specified permissions
 */
export declare function hasAnyPermission(membership: MembershipValidationResult, permissions: string[]): boolean;
/**
 * Check if user has all of the specified permissions
 */
export declare function hasAllPermissions(membership: MembershipValidationResult, permissions: string[]): boolean;
/**
 * Check if user has access to a specific feature
 */
export declare function hasFeature(membership: MembershipValidationResult, feature: string): boolean;
/**
 * Check if user is within usage limits
 */
export declare function isWithinUsageLimits(membership: MembershipValidationResult, usage: UsageMetrics): {
    isWithinLimits: boolean;
    violations: Array<{
        metric: string;
        current: number;
        limit: number;
        percentage: number;
    }>;
};
/**
 * Get usage warnings (approaching limits)
 */
export declare function getUsageWarnings(membership: MembershipValidationResult, usage: UsageMetrics, warningThreshold?: number): Array<{
    metric: string;
    current: number;
    limit: number;
    percentage: number;
    message: string;
}>;
/**
 * Calculate recommended tier based on usage
 */
export declare function getRecommendedTier(usage: UsageMetrics): {
    recommendedTier: MembershipTier;
    reasons: string[];
    currentTierSufficient: boolean;
};
/**
 * Check if membership is expired
 */
export declare function isMembershipExpired(membership: UserMembership): boolean;
/**
 * Check if membership is about to expire
 */
export declare function isMembershipExpiringSoon(membership: UserMembership, daysThreshold?: number): boolean;
/**
 * Get membership status summary
 */
export declare function getMembershipSummary(membership: UserMembership): {
    status: "active" | "expired" | "expiring_soon" | "canceled" | "inactive";
    message: string;
    actionRequired: boolean;
};
