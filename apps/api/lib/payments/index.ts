/**
 * Payment Provider Factory
 *
 * Thin wrapper around @beztack/payments that reads config from env.
 * All provider-specific logic lives in packages/payments/{provider}.
 */

import type { PaymentProviderAdapter, PaymentProviderName } from "@beztack/payments";
import { createPaymentProvider, getPaymentProvider as getCoreProvider } from "@beztack/payments";
import { env } from "@/env";
import { withDemoSubscriptions } from "@/server/utils/demo-payment-provider";
import { createDbDemoSubscriptionStore } from "@/server/utils/demo-subscription-store";

// Re-export all types from core so existing imports keep working
export type {
  BillingInterval,
  CheckoutResult,
  CreateCheckoutOptions,
  CreateProductOptions,
  CreateSubscriptionOptions,
  Customer,
  ListSubscriptionsOptions,
  PaymentProviderAdapter,
  PaymentProviderName,
  Product,
  Subscription,
  SubscriptionStatus,
  UpdateProductOptions,
  UpdateSubscriptionOptions,
  WebhookEventType,
  WebhookPayload,
} from "@beztack/payments";

// Re-export for backwards compatibility
export type PaymentProvider = PaymentProviderName;

let initialized = false;

// One decorated adapter per real adapter, so a reset of the core cache resets this too.
const demoAdapters = new WeakMap<PaymentProviderAdapter, PaymentProviderAdapter>();

/**
 * The adapter every caller gets. Only with `DEMO_MODE=true` it answers for the
 * seeded `demo_sub_*` Subscriptions (docs/demo.md); otherwise it is the real
 * adapter itself.
 */
function resolveAdapter(): PaymentProviderAdapter {
  const adapter = getCoreProvider();
  if (env.DEMO_MODE !== true) {
    return adapter;
  }

  let decorated = demoAdapters.get(adapter);
  if (!decorated) {
    decorated = withDemoSubscriptions(adapter, {
      demoMode: env.DEMO_MODE,
      store: () => createDbDemoSubscriptionStore(),
    });
    demoAdapters.set(adapter, decorated);
  }
  return decorated;
}

function getEnvConfig(): Record<string, string> {
  return {
    // Shared
    DEFAULT_CURRENCY: env.DEFAULT_CURRENCY,
    PAYMENTS_SUCCESS_URL: env.PAYMENTS_SUCCESS_URL || env.POLAR_SUCCESS_URL,
    PAYMENTS_CANCEL_URL: env.PAYMENTS_CANCEL_URL || env.POLAR_CANCEL_URL,
    // Polar
    POLAR_ACCESS_TOKEN: env.POLAR_ACCESS_TOKEN,
    POLAR_SERVER: env.POLAR_SERVER,
    POLAR_ORGANIZATION_ID: env.POLAR_ORGANIZATION_ID,
    POLAR_SUCCESS_URL: env.POLAR_SUCCESS_URL,
    POLAR_CANCEL_URL: env.POLAR_CANCEL_URL,
    // MercadoPago
    MERCADO_PAGO_ACCESS_TOKEN: env.MERCADO_PAGO_ACCESS_TOKEN,
    MERCADO_PAGO_APPLICATION_ID: env.MERCADO_PAGO_APPLICATION_ID,
    MERCADO_PAGO_WEBHOOK_SECRET: env.MERCADO_PAGO_WEBHOOK_SECRET,
    MERCADO_PAGO_INTEGRATOR_ID: env.MERCADO_PAGO_INTEGRATOR_ID,
  };
}

/**
 * Get the configured payment provider adapter.
 * Initializes lazily on first call using env vars.
 */
export function getPaymentProvider(): PaymentProviderAdapter {
  if (!initialized) {
    const provider = (env.PAYMENT_PROVIDER ?? "polar") as PaymentProviderName;
    // Fire-and-forget async init — the core factory caches the result
    createPaymentProvider(provider, getEnvConfig()).catch(() => {
      // Initialization errors will surface on first use via getCoreProvider()
    });
    initialized = true;
  }

  return resolveAdapter();
}

/**
 * Ensure the payment provider is fully initialized before returning.
 * Unlike getPaymentProvider() which uses fire-and-forget async init,
 * this awaits initialization so the adapter is guaranteed ready.
 */
export async function ensurePaymentProvider(): Promise<PaymentProviderAdapter> {
  if (!initialized) {
    const provider = (env.PAYMENT_PROVIDER ?? "polar") as PaymentProviderName;
    await createPaymentProvider(provider, getEnvConfig());
    initialized = true;
  }

  return resolveAdapter();
}

export { resetPaymentProvider } from "@beztack/payments";
