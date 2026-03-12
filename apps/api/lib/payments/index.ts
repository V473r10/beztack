/**
 * Payment Provider Factory
 *
 * Thin wrapper around @beztack/payments that reads config from env.
 * All provider-specific logic lives in packages/payments/{provider}.
 */

import type {
  PaymentProviderAdapter,
  PaymentProviderName,
} from "@beztack/payments";
import {
  createPaymentProvider,
  getPaymentProvider as getCoreProvider,
} from "@beztack/payments";
import { env } from "@/env";

// Re-export all types from core so existing imports keep working
export type {
  BillingInterval,
  CheckoutResult,
  CreateCheckoutOptions,
  CreateSubscriptionOptions,
  Customer,
  ListSubscriptionsOptions,
  PaymentProviderAdapter,
  PaymentProviderName,
  Product,
  Subscription,
  SubscriptionStatus,
  UpdateSubscriptionOptions,
  WebhookEventType,
  WebhookPayload,
} from "@beztack/payments";

// Re-export for backwards compatibility
export type PaymentProvider = PaymentProviderName;

let initialized = false;

function getEnvConfig(): Record<string, string> {
  return {
    // Shared
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

  return getCoreProvider();
}

export { resetPaymentProvider } from "@beztack/payments";
