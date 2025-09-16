import type { PolarPricingTier } from "@/types/polar-pricing";

export async function usePolarProducts(): Promise<PolarPricingTier[]> {
  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/api/polar/products`
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const polarTiers = await response.json();

  // The API now returns the complete data including features, limits, and permissions from the database
  return polarTiers;
}
