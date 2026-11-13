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
 *
 * The response carries no per-user data, so it is cached in-process for a few
 * seconds (`utils/products-cache`): fast navigation does not reach the
 * provider's rate limit. Admin plan changes invalidate it.
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
import {
  PRODUCTS_CACHE_TTL_MS,
  PRODUCTS_FALLBACK_TTL_MS,
  readThroughProductsCache,
} from "@/server/utils/products-cache";

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

type ProductsBody = {
  provider: string;
  products: Product[];
  source?: "catalog";
};

async function loadProducts(): Promise<{ body: ProductsBody; ttlMs: number }> {
  try {
    const provider = await ensurePaymentProvider();
    const providerProducts = await provider.listProducts();

    // Enrich all provider products with catalog metadata from DB
    const products = await Promise.all(providerProducts.map(enrichProductWithCatalog));

    return {
      body: {
        provider: provider.provider,
        products: [...products, ...(await catalogOnlyProducts(provider.provider, products))],
      },
      ttlMs: PRODUCTS_CACHE_TTL_MS,
    };
  } catch (error) {
    console.warn(
      "[products] Payment provider unavailable, serving the Pricing catalog:",
      error instanceof Error ? error.message : error,
    );

    return {
      body: {
        provider: env.PAYMENT_PROVIDER,
        products: await getCatalogProducts(env.PAYMENT_PROVIDER),
        source: "catalog",
      },
      ttlMs: PRODUCTS_FALLBACK_TTL_MS,
    };
  }
}

export default defineEventHandler(() => readThroughProductsCache(loadProducts));
