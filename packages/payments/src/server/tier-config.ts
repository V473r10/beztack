import type { MembershipTier, MembershipTierConfig } from "../types/membership.ts";

/**
 * Fetch tier configuration from Polar API
 * This replaces the hardcoded tiers.ts constants
 */
export async function fetchTierConfigs(): Promise<MembershipTierConfig[]> {
  try {
    const response = await fetch(`${process.env.API_BASE_URL}/api/polar/products`);
    if (!response.ok) {
      throw new Error(`Failed to fetch tier configs: ${response.statusText}`);
    }
    return await response.json() as MembershipTierConfig[];
  } catch (error) {
    console.error("Error fetching tier configurations:", error);
    throw error;
  }
}

/**
 * Get tier configuration for a specific tier from API
 */
export async function getServerTierInfo(tier: MembershipTier): Promise<MembershipTierConfig | undefined> {
  const configs = await fetchTierConfigs();
  return configs.find(config => config.id === tier);
}

/**
 * Get product ID for a specific tier and billing period
 */
export async function getTierProductId(tier: MembershipTier, billingPeriod: 'monthly' | 'yearly' = 'monthly'): Promise<string | undefined> {
  const config = await getServerTierInfo(tier);
  return billingPeriod === 'yearly' ? config?.yearly?.id : config?.monthly?.id;
}