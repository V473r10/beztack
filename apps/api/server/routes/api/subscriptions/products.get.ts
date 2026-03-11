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
  console.log("providerProducts", providerProducts);
  const products = await Promise.all(
    providerProducts.map(enrichProductWithCatalog)
  );
  console.log("products", products);
  const plans = await getCatalogPlans();
  console.log("plans", plans);

  return {
    provider: provider.provider,
    products,
    plans,
  };
});
