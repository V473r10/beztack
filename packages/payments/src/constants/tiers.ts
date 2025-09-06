import type { MembershipTierConfig } from "../types/membership.ts";

/**
 * Membership tier configurations based on VIT-17 strategy
 */
export const MEMBERSHIP_TIERS: Record<string, MembershipTierConfig> = {
  free: {
    id: "free",
    name: "Free",
    description: "Basic auth and essential features",
    price: {
      monthly: 0,
      yearly: 0,
    },
    features: [
      "Email/password authentication",
      "Social login",
      "Basic dashboard access",
      "Community support",
    ],
    permissions: [
      "auth:basic",
      "dashboard:view",
      "profile:manage",
    ],
    limits: {
      users: 1,
      organizations: 0,
      teams: 0,
      storage: 1, // 1GB
      apiCalls: 1000, // per month
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    description: "Advanced security and analytics for individuals",
    price: {
      monthly: 29,
      yearly: 290, // ~17% discount
    },
    features: [
      "Two-factor authentication (2FA)",
      "Passkeys support",
      "Advanced analytics",
      "Priority email support",
      "API access",
      "Export data",
    ],
    permissions: [
      "auth:basic",
      "auth:2fa",
      "auth:passkeys",
      "dashboard:view",
      "dashboard:analytics",
      "profile:manage",
      "api:access",
      "data:export",
    ],
    limits: {
      users: 1,
      organizations: 1,
      teams: 1,
      storage: 10, // 10GB
      apiCalls: 10000, // per month
    },
    polarProductId: undefined, // Set server-side via configuration
  },
  team: {
    id: "team",
    name: "Team",
    description: "Collaboration and team management",
    price: {
      monthly: 99,
      yearly: 990, // ~17% discount
    },
    features: [
      "All Pro features",
      "Organization management",
      "Team collaboration",
      "Role-based access control",
      "Team analytics",
      "Shared workspaces",
      "Advanced integrations",
    ],
    permissions: [
      "auth:basic",
      "auth:2fa",
      "auth:passkeys",
      "dashboard:view",
      "dashboard:analytics",
      "profile:manage",
      "api:access",
      "data:export",
      "org:manage",
      "org:invite",
      "team:manage",
      "team:analytics",
    ],
    limits: {
      users: 10,
      organizations: 5,
      teams: 20,
      storage: 100, // 100GB
      apiCalls: 50000, // per month
    },
    polarProductId: undefined,
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    description: "Custom solutions and priority support",
    price: {
      monthly: 499,
      yearly: 4990, // ~17% discount
    },
    features: [
      "All Team features",
      "Custom features",
      "Dedicated support",
      "SLA guarantees",
      "Custom integrations",
      "Advanced security",
      "Audit logs",
      "Custom branding",
    ],
    permissions: [
      "auth:basic",
      "auth:2fa",
      "auth:passkeys",
      "dashboard:view",
      "dashboard:analytics",
      "profile:manage",
      "api:access",
      "data:export",
      "org:manage",
      "org:invite",
      "team:manage",
      "team:analytics",
      "enterprise:features",
      "enterprise:support",
      "audit:view",
      "security:advanced",
    ],
    limits: {
      users: -1, // unlimited
      organizations: -1, // unlimited
      teams: -1, // unlimited
      storage: -1, // unlimited
      apiCalls: -1, // unlimited
    },
    polarProductId: undefined, // Set server-side via configuration
  },
} as const;

/**
 * Get tier configuration by ID
 */
export function getTierConfig(tier: string): MembershipTierConfig | undefined {
  return MEMBERSHIP_TIERS[tier];
}

/**
 * Get all available tiers
 */
export function getAllTiers(): MembershipTierConfig[] {
  return Object.values(MEMBERSHIP_TIERS);
}

/**
 * Check if a tier exists
 */
export function isValidTier(tier: string): tier is keyof typeof MEMBERSHIP_TIERS {
  return tier in MEMBERSHIP_TIERS;
}

/**
 * Get tier hierarchy (for upgrade/downgrade logic)
 */
export const TIER_HIERARCHY = ["free", "basic", "pro", "ultimate"] as const;

/**
 * Get tier level (0-based index in hierarchy)
 */
export function getTierLevel(tier: string): number {
  return TIER_HIERARCHY.indexOf(tier as any);
}

/**
 * Check if tier A is higher than tier B
 */
export function isTierHigher(tierA: string, tierB: string): boolean {
  return getTierLevel(tierA) > getTierLevel(tierB);
}