/**
 * Polar Better Auth server plugin wrapper
 *
 * Wraps @polar-sh/better-auth so that apps/api never imports Polar directly.
 */
import { checkout, polar, portal, usage } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";

export type PolarAuthPluginConfig = {
  accessToken: string;
  server: "sandbox" | "production";
  createCustomerOnSignUp?: boolean;
  getCustomerCreateParams?: (data: {
    user: { id?: string; email?: string; name?: string };
  }) => Promise<{
    metadata?: Record<string, string | number | boolean>;
  }>;
  products: Array<{ productId: string; slug: string }>;
  successUrl: string;
  authenticatedUsersOnly?: boolean;
};

/**
 * Create the Polar Better Auth server plugin.
 * Returns null if config is missing or provider is not polar.
 */
export function createPolarAuthPlugin(
  config: PolarAuthPluginConfig
): ReturnType<typeof polar> {
  const client = new Polar({
    accessToken: config.accessToken,
    server: config.server,
  });

  return polar({
    client,
    createCustomerOnSignUp: config.createCustomerOnSignUp ?? false,
    getCustomerCreateParams: config.getCustomerCreateParams,
    use: [
      checkout({
        products: config.products,
        successUrl: config.successUrl,
        authenticatedUsersOnly: config.authenticatedUsersOnly ?? true,
      }),
      portal(),
      usage(),
    ],
  });
}
