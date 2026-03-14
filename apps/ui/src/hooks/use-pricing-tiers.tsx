/**
 * Provider-agnostic pricing tiers hook
 *
 * Delegates to @beztack/payments/react.
 */

import type { PricingTier } from "@beztack/payments";
import { fetchPricingTiers } from "@beztack/payments/react";
import { env } from "@/env";

export function usePricingTiers(): Promise<PricingTier[]> {
  return fetchPricingTiers(env.VITE_API_URL);
}
