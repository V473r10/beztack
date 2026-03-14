/**
 * Unified Products/Plans endpoint
 * Works with both Polar and Mercado Pago based on PAYMENT_PROVIDER config
 */
import { defineEventHandler } from "h3";
import { getPaymentProvider } from "@/lib/payments";
import { buildCatalogPlanFromProduct } from "@/lib/payments/catalog";
import {
  enrichProductWithCatalog,
  getCatalogPlans,
} from "@/lib/payments/catalog-mp";

export default defineEventHandler(async () => {
  const provider = getPaymentProvider();
  const providerProducts = await provider.listProducts();

  if (provider.provider === "polar") {
    // Polar: products already have metadata from Polar API, no DB enrichment needed
    const products = providerProducts.filter(
      (product) => product.metadata?.type !== "plan"
    );
    const plans = providerProducts
      .filter((product) => product.metadata?.type === "plan")
      .map(buildCatalogPlanFromProduct);

    return {
      provider: provider.provider,
      products,
      plans,
    };
  }

  // Mercado Pago: enrich products with catalog data from DB
  const catalogProducts = await Promise.all(
    providerProducts.map(enrichProductWithCatalog)
  );
  const plans = await getCatalogPlans();

  return {
    provider: provider.provider,
    products: catalogProducts,
    plans,
  };
});
