import { createPolarClient, getPolarConfigFromEnv } from "@buncn/payments/server";
import type { PolarClientConfig } from "@buncn/payments/server";

/**
 * Create a configured Polar client instance
 * Uses environment variables for configuration
 */
export function createConfiguredPolarClient() {
  const config = getPolarConfigFromEnv();
  
  if (!config) {
    console.warn('Polar configuration not found in environment variables');
    return null;
  }
  
  return createPolarClient(config);
}

/**
 * Get Polar configuration from environment with validation
 */
export function getPolarConfig(): PolarClientConfig | null {
  const accessToken = process.env.POLAR_ACCESS_TOKEN;
  const server = process.env.POLAR_SERVER as 'sandbox' | 'production' | undefined;
  
  if (!accessToken) {
    console.warn('POLAR_ACCESS_TOKEN not found in environment variables');
    return null;
  }
  
  return {
    accessToken,
    server: server || 'sandbox'
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
  const products = [];
  
  if (process.env.POLAR_PRO_PRODUCT_ID) {
    products.push({
      productId: process.env.POLAR_PRO_PRODUCT_ID,
      slug: 'pro'
    });
  }
  
  if (process.env.POLAR_ENTERPRISE_PRODUCT_ID) {
    products.push({
      productId: process.env.POLAR_ENTERPRISE_PRODUCT_ID,
      slug: 'enterprise'
    });
  }
  
  return products;
}

/**
 * Get success and cancel URLs for checkout
 */
export function getCheckoutUrls() {
  return {
    successUrl: process.env.POLAR_SUCCESS_URL || "http://localhost:5173/success?checkout_id={CHECKOUT_ID}",
    cancelUrl: process.env.POLAR_CANCEL_URL || "http://localhost:5173/pricing"
  };
}