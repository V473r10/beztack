/**
 * Payment Provider Factory
 * Provides a unified interface for payment providers (Polar, Mercado Pago)
 */
import { env } from "@/env";
import { createMercadoPagoAdapter } from "./adapters/mercadopago";
import { createPolarAdapter } from "./adapters/polar";
import type { PaymentProvider, PaymentProviderAdapter } from "./types";

export { createMercadoPagoAdapter } from "./adapters/mercadopago";
export { createPolarAdapter } from "./adapters/polar";
export * from "./types";

let cachedAdapter: PaymentProviderAdapter | null = null;

function getSuccessUrl(): string {
  return env.PAYMENTS_SUCCESS_URL || env.POLAR_SUCCESS_URL;
}

function getCancelUrl(): string {
  return env.PAYMENTS_CANCEL_URL || env.POLAR_CANCEL_URL;
}

/**
 * Get the configured payment provider adapter
 * Uses PAYMENT_PROVIDER env variable to determine which adapter to use
 */
export function getPaymentProvider(): PaymentProviderAdapter {
  if (cachedAdapter) {
    return cachedAdapter;
  }

  const provider = (env.PAYMENT_PROVIDER ?? "polar") as PaymentProvider;

  switch (provider) {
    case "mercadopago": {
      cachedAdapter = createMercadoPagoAdapter({
        accessToken: env.MERCADO_PAGO_ACCESS_TOKEN,
        successUrl: getSuccessUrl(),
        cancelUrl: getCancelUrl(),
        currency: "UYU",
      });
      break;
    }
    default: {
      cachedAdapter = createPolarAdapter({
        accessToken: env.POLAR_ACCESS_TOKEN,
        server: env.POLAR_SERVER,
        organizationId: env.POLAR_ORGANIZATION_ID,
        successUrl: getSuccessUrl(),
        cancelUrl: getCancelUrl(),
      });
      break;
    }
  }

  return cachedAdapter;
}

/**
 * Get a specific payment provider adapter by name
 */
export function getPaymentProviderByName(
  provider: PaymentProvider
): PaymentProviderAdapter {
  switch (provider) {
    case "mercadopago": {
      return createMercadoPagoAdapter({
        accessToken: env.MERCADO_PAGO_ACCESS_TOKEN,
        successUrl: getSuccessUrl(),
        cancelUrl: getCancelUrl(),
        currency: "UYU",
      });
    }
    default: {
      return createPolarAdapter({
        accessToken: env.POLAR_ACCESS_TOKEN,
        server: env.POLAR_SERVER,
        organizationId: env.POLAR_ORGANIZATION_ID,
        successUrl: getSuccessUrl(),
        cancelUrl: getCancelUrl(),
      });
    }
  }
}

/**
 * Reset the cached adapter (useful for testing or config changes)
 */
export function resetPaymentProvider(): void {
  cachedAdapter = null;
}
