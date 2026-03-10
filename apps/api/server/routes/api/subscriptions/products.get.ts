/**
 * Unified Products/Plans endpoint
 * Works with both Polar and Mercado Pago based on PAYMENT_PROVIDER config
 */
import { defineEventHandler } from "h3";
import { getPaymentProvider } from "@/lib/payments";
import {
  enrichProductWithCatalog,
  getCatalogPlans,
} from "@/lib/payments/catalog";

export default defineEventHandler(async () => {
  const provider = getPaymentProvider();
  const providerProducts = await provider.listProducts();
  const products = await Promise.all(
    providerProducts.map(enrichProductWithCatalog)
  );
  const plans = await getCatalogPlans();

  return {
    provider: provider.provider,
    products,
    plans,
  };
});
