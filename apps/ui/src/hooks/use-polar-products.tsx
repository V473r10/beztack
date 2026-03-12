/**
 * Provider-agnostic pricing tiers hook
 *
 * Delegates to @beztack/payments/react. The "usePolarProducts" name is kept
 * for backwards compatibility — all consumers import this function as a queryFn.
 */
import { fetchPricingTiers } from "@beztack/payments/react";
import { env } from "@/env";
import type { PolarPricingTier } from "@/types/polar-pricing";

export function usePolarProducts(): Promise<PolarPricingTier[]> {
  return fetchPricingTiers(env.VITE_API_URL);
}
