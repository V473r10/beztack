/**
 * Unified Products/Plans endpoint
 * Works with both Polar and Mercado Pago based on PAYMENT_PROVIDER config
 *
 * Returns ALL provider items as `products` — the frontend hooks transform
 * them into PricingTiers, so no server-side filtering is needed — plus the
 * visible catalog plans that have no provider product (Free).
 *
 * When the Payment provider cannot be reached, the products come from the
 * Pricing catalog instead (`source: "catalog"`), so a provider outage does not
 * take the pricing page down. An Admin tier override needs nothing else.
 */
import { defineEventHandler } from "h3";
import { env } from "@/env";
import { ensurePaymentProvider } from "@/lib/payments";
import {
  enrichProductWithCatalog,
  getCatalogOnlyProducts,
  getCatalogProducts,
} from "@/lib/payments/catalog-mp";
import type { Product } from "@/lib/payments/types";

function tierOf(product: Product): string {
  const { tier, planId } = product.metadata ?? {};
  if (typeof tier === "string") {
    return tier;
  }
  return typeof planId === "string" ? planId : product.id;
}

/**
 * Catalog plans with no product at the provider (Free), for the tiers the
 * provider does not sell. A tier the provider sells keeps only its own
 * products, so a half-synced tier never mixes the two. The catalog is
 * secondary here: if it cannot be read, the provider's products still answer.
 */
async function catalogOnlyProducts(
  paymentProvider: string,
  providerProducts: Product[],
): Promise<Product[]> {
  try {
    const soldTiers = new Set(providerProducts.map(tierOf));
    const rows = await getCatalogOnlyProducts(paymentProvider);

    return rows.filter((row) => !soldTiers.has(tierOf(row)));
  } catch (error) {
    console.warn(
      "[products] Could not read the catalog-only plans:",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

export default defineEventHandler(async () => {
  try {
    const provider = await ensurePaymentProvider();
    const providerProducts = await provider.listProducts();

    // Enrich all provider products with catalog metadata from DB
    const products = await Promise.all(providerProducts.map(enrichProductWithCatalog));

    return {
      provider: provider.provider,
      products: [...products, ...(await catalogOnlyProducts(provider.provider, products))],
    };
  } catch (error) {
    console.warn(
      "[products] Payment provider unavailable, serving the Pricing catalog:",
      error instanceof Error ? error.message : error,
    );

    return {
      provider: env.PAYMENT_PROVIDER,
      products: await getCatalogProducts(env.PAYMENT_PROVIDER),
      source: "catalog" as const,
    };
  }
});
