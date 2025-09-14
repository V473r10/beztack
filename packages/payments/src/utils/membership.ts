import { MEMBERSHIP_TIERS } from "../constants/index.ts";
import type {
  CustomerPortalState,
  MembershipTier,
  MembershipValidationResult,
  UsageMetrics,
  UserMembership,
} from "../types/index.ts";
// Note: Tier configurations are now fetched dynamically from API
// See packages/payments/src/server/tier-config.ts for dynamic functions

/**
 * Validate user membership based on customer portal state
 * Note: This function now returns basic validation - full tier details should be fetched from API
 */
export function validateMembership(
  state: CustomerPortalState
): MembershipValidationResult {
  try {
    // Check for active subscriptions
    const activeSubscriptions = state.subscriptions.filter(
      (sub) => sub.status === "active" || sub.status === "trialing"
    );

    if (activeSubscriptions.length === 0) {
      return {
        isValid: true,
        tier: "free",
        permissions: ["auth:basic", "dashboard:view", "profile:manage"],
        limits: {
          users: 1,
          organizations: 0,
          teams: 0,
          storage: 1,
          apiCalls: 1000,
        },
        features: ["social-login", "basic-dashboard-access"],
      };
    }

    // Determine highest tier from active subscriptions
    const tierHierarchy: MembershipTier[] = [
      "free",
      "pro",
      "team",
      "enterprise",
    ];
    let highestTier: MembershipTier = "free";

    for (const subscription of activeSubscriptions) {
      const tier = subscription.metadata?.tier as MembershipTier;
      if (tier && tierHierarchy.includes(tier)) {
        const currentIndex = tierHierarchy.indexOf(highestTier);
        const tierIndex = tierHierarchy.indexOf(tier);
        if (tierIndex > currentIndex) {
          highestTier = tier;
        }
      }
    }

    // Return basic validation - detailed config should be fetched from API
    return {
      isValid: true,
      tier: highestTier,
      permissions: [], // Fetch from API
      limits: {}, // Fetch from API
      features: [], // Fetch from API
    };
  } catch (error) {
    return {
      isValid: false,
      tier: "free",
      permissions: [],
      limits: {},
      features: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check if user has specific permission
 */
export function hasPermission(
  membership: MembershipValidationResult,
  permission: string
): boolean {
  return membership.permissions.includes(permission);
}

/**
 * Check if user has any of the specified permissions
 */
export function hasAnyPermission(
  membership: MembershipValidationResult,
  permissions: string[]
): boolean {
  return permissions.some((permission) =>
    hasPermission(membership, permission)
  );
}

/**
 * Check if user has all of the specified permissions
 */
export function hasAllPermissions(
  membership: MembershipValidationResult,
  permissions: string[]
): boolean {
  return permissions.every((permission) =>
    hasPermission(membership, permission)
  );
}

/**
 * Check if user has access to a specific feature
 */
export function hasFeature(
  membership: MembershipValidationResult,
  feature: string
): boolean {
  return membership.features.includes(feature);
}

/**
 * Check if user is within usage limits
 */
export function isWithinUsageLimits(
  membership: MembershipValidationResult,
  usage: UsageMetrics
): {
  isWithinLimits: boolean;
  violations: Array<{
    metric: string;
    current: number;
    limit: number;
    percentage: number;
  }>;
} {
  const violations = [];
  const limits = membership.limits;

  // Check each limit
  const checks = [
    {
      metric: "apiCalls",
      current: usage.metrics.apiCalls,
      limit: limits.apiCalls,
    },
    {
      metric: "storageUsed",
      current: usage.metrics.storageUsed,
      limit: limits.storage,
    },
    {
      metric: "activeUsers",
      current: usage.metrics.activeUsers,
      limit: limits.users,
    },
    {
      metric: "organizations",
      current: usage.metrics.organizations,
      limit: limits.organizations,
    },
    { metric: "teams", current: usage.metrics.teams, limit: limits.teams },
  ];

  for (const check of checks) {
    if (check.limit && check.limit > 0 && check.current > check.limit) {
      violations.push({
        metric: check.metric,
        current: check.current,
        limit: check.limit,
        percentage: (check.current / check.limit) * 100,
      });
    }
  }

  return {
    isWithinLimits: violations.length === 0,
    violations,
  };
}

/**
 * Get usage warnings (approaching limits)
 */
export function getUsageWarnings(
  membership: MembershipValidationResult,
  usage: UsageMetrics,
  warningThreshold = 80
): Array<{
  metric: string;
  current: number;
  limit: number;
  percentage: number;
  message: string;
}> {
  const warnings = [];
  const limits = membership.limits;

  const checks = [
    {
      metric: "apiCalls",
      current: usage.metrics.apiCalls,
      limit: limits.apiCalls,
      label: "API calls",
    },
    {
      metric: "storageUsed",
      current: usage.metrics.storageUsed,
      limit: limits.storage,
      label: "storage",
    },
    {
      metric: "activeUsers",
      current: usage.metrics.activeUsers,
      limit: limits.users,
      label: "active users",
    },
    {
      metric: "organizations",
      current: usage.metrics.organizations,
      limit: limits.organizations,
      label: "organizations",
    },
    {
      metric: "teams",
      current: usage.metrics.teams,
      limit: limits.teams,
      label: "teams",
    },
  ];

  for (const check of checks) {
    if (check.limit && check.limit > 0) {
      const percentage = (check.current / check.limit) * 100;
      if (percentage >= warningThreshold && percentage < 100) {
        warnings.push({
          metric: check.metric,
          current: check.current,
          limit: check.limit,
          percentage,
          message: `You are using ${Math.round(percentage)}% of your ${check.label} limit (${check.current}/${check.limit})`,
        });
      }
    }
  }

  return warnings;
}

/**
 * Calculate recommended tier based on usage
 */
export function getRecommendedTier(usage: UsageMetrics): {
  recommendedTier: MembershipTier;
  reasons: string[];
  currentTierSufficient: boolean;
} {
  const reasons: string[] = [];
  let recommendedTier: MembershipTier = "free";

  // Check against each tier's limits
  const tiers = Object.values(MEMBERSHIP_TIERS);

  for (const tier of tiers) {
    const exceedsLimits = [
      {
        metric: "API calls",
        current: usage.metrics.apiCalls,
        limit: tier.limits.apiCalls,
      },
      {
        metric: "Storage",
        current: usage.metrics.storageUsed,
        limit: tier.limits.storage,
      },
      {
        metric: "Users",
        current: usage.metrics.activeUsers,
        limit: tier.limits.users,
      },
      {
        metric: "Organizations",
        current: usage.metrics.organizations,
        limit: tier.limits.organizations,
      },
      {
        metric: "Teams",
        current: usage.metrics.teams,
        limit: tier.limits.teams,
      },
    ].filter(
      (check) => check.limit && check.limit > 0 && check.current > check.limit
    );

    if (exceedsLimits.length === 0) {
      // This tier can handle the usage
      break;
    }
    recommendedTier = tier.id;
    reasons.push(
      ...exceedsLimits.map(
        (check) => `${check.metric}: ${check.current} (exceeds ${check.limit})`
      )
    );
  }

  return {
    recommendedTier,
    reasons,
    currentTierSufficient: reasons.length === 0,
  };
}

/**
 * Check if membership is expired
 */
export function isMembershipExpired(membership: UserMembership): boolean {
  if (!membership.validUntil) {
    return false; // No expiration date means it doesn't expire
  }

  return new Date() > membership.validUntil;
}

/**
 * Check if membership is about to expire
 */
export function isMembershipExpiringSoon(
  membership: UserMembership,
  daysThreshold = 7
): boolean {
  if (!membership.validUntil) {
    return false;
  }

  const now = new Date();
  const threshold = new Date(
    now.getTime() + daysThreshold * 24 * 60 * 60 * 1000
  );

  return membership.validUntil <= threshold && membership.validUntil > now;
}

/**
 * Get membership status summary
 */
export function getMembershipSummary(membership: UserMembership): {
  status: "active" | "expired" | "expiring_soon" | "canceled" | "inactive";
  message: string;
  actionRequired: boolean;
} {
  if (membership.status === "canceled") {
    return {
      status: "canceled",
      message: "Your membership has been canceled",
      actionRequired: true,
    };
  }

  if (membership.status === "inactive") {
    return {
      status: "inactive",
      message: "Your membership is inactive",
      actionRequired: true,
    };
  }

  if (isMembershipExpired(membership)) {
    return {
      status: "expired",
      message: "Your membership has expired",
      actionRequired: true,
    };
  }

  if (isMembershipExpiringSoon(membership)) {
    return {
      status: "expiring_soon",
      message: `Your membership expires on ${membership.validUntil?.toLocaleDateString()}`,
      actionRequired: true,
    };
  }

  return {
    status: "active",
    message: "Your membership is active",
    actionRequired: false,
  };
}
