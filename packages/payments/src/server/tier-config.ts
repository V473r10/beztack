import { MEMBERSHIP_TIERS } from "../constants/tiers.ts";
import type { MembershipTier, MembershipTierConfig } from "../types/membership.ts";

/**
 * Server-side tier configuration with environment variable population
 */
export function getServerTierConfig(): Record<MembershipTier, MembershipTierConfig> {
  return {
    free: MEMBERSHIP_TIERS.free!,
    pro: {
      ...MEMBERSHIP_TIERS.pro!,
      polarProductId: process.env.POLAR_PRO_PRODUCT_ID,
    } as MembershipTierConfig,
    team: {
      ...MEMBERSHIP_TIERS.team!,
      polarProductId: process.env.POLAR_TEAM_PRODUCT_ID,
    } as MembershipTierConfig,
    enterprise: {
      ...MEMBERSHIP_TIERS.enterprise!,
      polarProductId: process.env.POLAR_ENTERPRISE_PRODUCT_ID,
    } as MembershipTierConfig,
  };
}

/**
 * Get product ID for a specific tier
 */
export function getTierProductId(tier: MembershipTier): string | undefined {
  const config = getServerTierConfig();
  return config[tier]?.polarProductId;
}

/**
 * Get tier configuration for a specific tier with server-side data
 */
export function getServerTierInfo(tier: MembershipTier) {
  const config = getServerTierConfig();
  return config[tier];
}