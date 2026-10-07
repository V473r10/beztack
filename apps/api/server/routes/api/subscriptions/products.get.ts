/**
 * Unified Products/Plans endpoint
 * Works with both Polar and Mercado Pago based on PAYMENT_PROVIDER config
 *
 * Returns ALL provider items as `products` — the frontend hooks transform
 * them into PricingTiers, so no server-side filtering is needed.
 *
 * When the Payment provider cannot be reached, the products come from the
 * Pricing catalog instead (`source: "catalog"`), so a provider outage does not
 * take the pricing page down. An Admin tier override needs nothing else.
 */
import { defineEventHandler } from "h3";
import { env } from "@/env";
import { ensurePaymentProvider } from "@/lib/payments";
import { enrichProductWithCatalog, getCatalogProducts } from "@/lib/payments/catalog-mp";

export default defineEventHandler(async () => {
  try {
    const provider = await ensurePaymentProvider();
    const providerProducts = await provider.listProducts();

    // Enrich all provider products with catalog metadata from DB
    const products = await Promise.all(providerProducts.map(enrichProductWithCatalog));

    return {
      provider: provider.provider,
      products,
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
