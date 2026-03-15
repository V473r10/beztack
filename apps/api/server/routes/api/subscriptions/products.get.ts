/**
 * Unified Products/Plans endpoint
 * Works with both Polar and Mercado Pago based on PAYMENT_PROVIDER config
 *
 * Returns ALL provider items as `products` — the frontend hooks transform
 * them into PricingTiers, so no server-side filtering is needed.
 */
import { defineEventHandler } from "h3";
import { ensurePaymentProvider } from "@/lib/payments";
import { enrichProductWithCatalog } from "@/lib/payments/catalog-mp";

export default defineEventHandler(async () => {
  const provider = await ensurePaymentProvider();
  const providerProducts = await provider.listProducts();

  // Enrich all provider products with catalog metadata from DB
  const products = await Promise.all(
    providerProducts.map(enrichProductWithCatalog)
  );

  return {
    provider: provider.provider,
    products,
  };
});
