/**
 * Unified Products/Plans endpoint
 * Works with both Polar and Mercado Pago based on PAYMENT_PROVIDER config
 */
import { defineEventHandler } from "h3";
import { getPaymentProvider } from "@/lib/payments";

export default defineEventHandler(async () => {
  const provider = getPaymentProvider();
  const products = await provider.listProducts();

  return {
    provider: provider.provider,
    products,
  };
});
