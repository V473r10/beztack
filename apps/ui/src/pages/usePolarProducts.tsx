import type { PolarPricingTier } from "@/types/polar-pricing";

// Default features by tier - can be moved to Polar benefits later
export const DEFAULT_FEATURES = {
  basic: [
    "Email/password authentication",
    "Basic dashboard access", 
    "Community support",
    "API access"
  ],
  pro: [
    "All Basic features",
    "Advanced analytics",
    "Priority email support", 
    "Team collaboration",
    "Export data"
  ],
  ultimate: [
    "All Pro features",
    "Custom integrations",
    "Dedicated support",
    "Advanced security",
    "Unlimited storage",
    "SLA guarantees"
  ]
};

export const DEFAULT_LIMITS = {
  basic: { users: 1, storage: 5, apiCalls: 1000 },
  pro: { users: 5, storage: 50, apiCalls: 10000 },
  ultimate: { users: -1, storage: -1, apiCalls: -1 }
};

export async function usePolarProducts(): Promise<PolarPricingTier[]> {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/polar/products`);
    const polarTiers = await response.json();

    // Use Polar data directly, add default features and limits
    const tiersWithDefaults = polarTiers.map((tier: PolarPricingTier) => ({
      ...tier,
      features: DEFAULT_FEATURES[tier.id as keyof typeof DEFAULT_FEATURES] || [],
      limits: DEFAULT_LIMITS[tier.id as keyof typeof DEFAULT_LIMITS] || {}
    }));

    return tiersWithDefaults;
  } catch (error) {
    console.error('Failed to fetch Polar products:', error);
    // Return empty array on error - no fallback to hardcoded data
    return [];
  }
}
