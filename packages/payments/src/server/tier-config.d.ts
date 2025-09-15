import type { MembershipTier, MembershipTierConfig } from "../types/membership.ts";
/**
 * Fetch tier configuration from Polar API
 * This replaces the hardcoded tiers.ts constants
 */
export declare function fetchTierConfigs(): Promise<MembershipTierConfig[]>;
/**
 * Get tier configuration for a specific tier from API
 */
export declare function getServerTierInfo(tier: MembershipTier): Promise<MembershipTierConfig | undefined>;
/**
 * Get product ID for a specific tier and billing period
 */
export declare function getTierProductId(tier: MembershipTier, billingPeriod?: "monthly" | "yearly"): Promise<string | undefined>;
