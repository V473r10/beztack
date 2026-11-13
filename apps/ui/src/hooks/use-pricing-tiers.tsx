/**
 * Provider-agnostic pricing tiers hook
 *
 * Delegates to @beztack/payments/react.
 *
 * Pages read the provider's products in two shapes: the raw response
 * (`MembershipProvider`) and the pricing tiers built from it (pricing, the
 * Plan change dialog, ...). Both go through ONE query key, so a page asks the
 * API for the products once and each component selects the shape it needs.
 */

import type { PricingTier, Product } from "@beztack/payments";
import { buildPricingTiers, fetchPricingTiers } from "@beztack/payments/react";
import type { UseQueryOptions } from "@tanstack/react-query";
import type { ProductsResponse } from "@/contexts/membership/membership-types";
import { env } from "@/env";
import { requestJson } from "@/lib/api-client";
import { shouldRetryBillingQuery } from "@/lib/billing-errors";
import { queryKeys } from "@/lib/query-keys";

const MILLISECONDS_PER_MINUTE = 60_000;
const PRODUCTS_STALE_TIME_MINUTES = 5;

const PRODUCTS_STALE_TIME = PRODUCTS_STALE_TIME_MINUTES * MILLISECONDS_PER_MINUTE;

export function usePricingTiers(): Promise<PricingTier[]> {
  return fetchPricingTiers(env.VITE_API_URL);
}

function selectPricingTiers(response: ProductsResponse): PricingTier[] {
  // The API returns the full provider product; the UI type keeps only what it reads.
  return buildPricingTiers(response.products as Product[]);
}

/** The provider's products, as the API answers them. */
export function productsQueryOptions(): UseQueryOptions<ProductsResponse> {
  return {
    queryKey: queryKeys.subscriptions.products(),
    queryFn: () => requestJson<ProductsResponse>("/api/subscriptions/products"),
    staleTime: PRODUCTS_STALE_TIME,
    retry: shouldRetryBillingQuery,
  };
}

/** The same query, selected as pricing tiers: no second request. */
export function pricingTiersQueryOptions(): UseQueryOptions<
  ProductsResponse,
  Error,
  PricingTier[]
> {
  return {
    ...productsQueryOptions(),
    select: selectPricingTiers,
  } as UseQueryOptions<ProductsResponse, Error, PricingTier[]>;
}
