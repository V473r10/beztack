import type { PolarClientConfig } from "@nvn/payments/server";
import { createPolarClient, getPolarConfigFromEnv } from "@nvn/payments/server";

/**
 * Create a configured Polar client instance
 * Uses environment variables for configuration
 */
export function createConfiguredPolarClient() {
  const config = getPolarConfigFromEnv();

  if (!config) {
    return null;
  }

  return createPolarClient(config);
}

/**
 * Get Polar configuration from environment with validation
 */
export function getPolarConfig(): PolarClientConfig | null {
  const accessToken = process.env.POLAR_ACCESS_TOKEN;
  const server = process.env.POLAR_SERVER as
    | "sandbox"
    | "production"
    | undefined;

  if (!accessToken) {
    return null;
  }

  return {
    accessToken,
    server: server || "sandbox",
  };
}

/**
 * Check if Polar integration is properly configured
 */
export function isPolarConfigured(): {
  configured: boolean;
  missing: string[];
  warnings: string[];
} {
  const missing: string[] = [];
  const warnings: string[] = [];

  if (!process.env.POLAR_ACCESS_TOKEN) {
    missing.push("POLAR_ACCESS_TOKEN");
  }

  if (!process.env.POLAR_WEBHOOK_SECRET) {
    warnings.push("POLAR_WEBHOOK_SECRET (webhooks will be disabled)");
  }

  const server = process.env.POLAR_SERVER;
  if (server && !["sandbox", "production"].includes(server)) {
    warnings.push(
      `POLAR_SERVER should be 'sandbox' or 'production', got: ${server}`
    );
  }

  if (
    !(
      process.env.POLAR_BASIC_MONTHLY_PRODUCT_ID ||
      process.env.POLAR_BASIC_YEARLY_PRODUCT_ID ||
      process.env.POLAR_PRO_MONTHLY_PRODUCT_ID ||
      process.env.POLAR_PRO_YEARLY_PRODUCT_ID ||
      process.env.POLAR_ULTIMATE_MONTHLY_PRODUCT_ID ||
      process.env.POLAR_ULTIMATE_YEARLY_PRODUCT_ID
    )
  ) {
    warnings.push("No product IDs configured - checkout may not work properly");
  }

  return {
    configured: missing.length === 0,
    missing,
    warnings,
  };
}

/**
 * Get webhook secret from environment
 */
export function getPolarWebhookSecret(): string | undefined {
  return process.env.POLAR_WEBHOOK_SECRET;
}

/**
 * Get Polar product configuration from environment
 */
export function getPolarProducts() {
  const products: Array<{ id: string; tier: string; type: string }> = [];

  if (process.env.POLAR_PRO_MONTHLY_PRODUCT_ID) {
    products.push({
      productId: process.env.POLAR_PRO_MONTHLY_PRODUCT_ID,
      slug: "pro",
    });
  }

  if (process.env.POLAR_ULTIMATE_MONTHLY_PRODUCT_ID) {
    products.push({
      productId: process.env.POLAR_ULTIMATE_MONTHLY_PRODUCT_ID,
      slug: "ultimate",
    });
  }

  return products;
}

/**
 * Get success and cancel URLs for checkout
 */
export function getCheckoutUrls() {
  return {
    successUrl:
      process.env.POLAR_SUCCESS_URL ||
      "http://localhost:5173/success?checkout_id={CHECKOUT_ID}",
    cancelUrl: process.env.POLAR_CANCEL_URL || "http://localhost:5173/pricing",
  };
}
