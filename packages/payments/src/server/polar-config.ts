import {
  checkout,
  polar,
  portal,
  usage,
  webhooks,
} from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";
import { POLAR_CONFIG } from "../constants/index.ts";
import type { MembershipTier } from "../types/index.ts";

/**
 * Polar client configuration
 */
export type PolarClientConfig = {
  accessToken: string;
  server?: "production" | "sandbox";
};

/**
 * Create Polar SDK client
 */
export function createPolarClient(config: PolarClientConfig): Polar {
  return new Polar({
    accessToken: config.accessToken,
    server: config.server ?? "production",
  });
}

/**
 * Webhook handlers configuration
 */
export type WebhookHandlers = {
  onCustomerStateChanged?: (payload: any) => Promise<void>;
  onOrderPaid?: (payload: any) => Promise<void>;
  onSubscriptionCreated?: (payload: any) => Promise<void>;
  onSubscriptionUpdated?: (payload: any) => Promise<void>;
  onSubscriptionActive?: (payload: any) => Promise<void>;
  onSubscriptionCanceled?: (payload: any) => Promise<void>;
  onSubscriptionRevoked?: (payload: any) => Promise<void>;
  onCheckoutCreated?: (payload: any) => Promise<void>;
  onCheckoutUpdated?: (payload: any) => Promise<void>;
  onBenefitGrantCreated?: (payload: any) => Promise<void>;
  onBenefitGrantUpdated?: (payload: any) => Promise<void>;
  onBenefitGrantRevoked?: (payload: any) => Promise<void>;
  onPayload?: (payload: any) => Promise<void>;
};

/**
 * Polar plugin configuration
 */
export type PolarPluginConfig = {
  client: Polar;
  createCustomerOnSignUp?: boolean;
  getCustomerCreateParams?: (
    data: {
      user: {
        id: string;
        email: string;
        emailVerified: boolean;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        image?: string | null;
      };
    },
    request?: Request
  ) => Promise<{
    metadata?: Record<string, any>;
  }>;
  webhookSecret?: string;
  webhookHandlers?: WebhookHandlers;
  successUrl?: string;
  cancelUrl?: string;
  authenticatedUsersOnly?: boolean;
};

/**
 * Create Polar Better Auth plugin with full configuration
 * Note: Products should be provided via config since tiers are now dynamic
 */
export function createPolarPlugin(
  config: PolarPluginConfig & {
    products?: Array<{ productId: string; slug: string }>;
  }
) {
  const products = config.products || [];

  return polar({
    client: config.client,
    createCustomerOnSignUp: config.createCustomerOnSignUp ?? true,
    getCustomerCreateParams:
      config.getCustomerCreateParams ??
      (async ({ user }) => ({
        metadata: {
          userId: user.id,
          email: user.email,
          name: user.name,
        },
      })),
    use: [
      checkout({
        products,
        successUrl: config.successUrl ?? POLAR_CONFIG.SUCCESS_URL,
        authenticatedUsersOnly: config.authenticatedUsersOnly ?? true,
      }),
      portal(),
      usage(),
      ...(config.webhookSecret && config.webhookHandlers
        ? [
            webhooks({
              secret: config.webhookSecret,
              ...config.webhookHandlers,
            }),
          ]
        : []),
    ],
  });
}

// Import default handlers from webhooks module (avoiding duplicate definition)
function getDefaultWebhookHandlers(): WebhookHandlers {
  return {
    onCustomerStateChanged: async (_payload) => {
      // TODO: Update user membership in database
    },

    onOrderPaid: async (payload) => {
      const order = payload.order;
      if (order?.metadata?.userId && order?.metadata?.tier) {
        // TODO: Activate membership for user
        const _tier = order.metadata.tier as MembershipTier;
      }
    },

    onSubscriptionActive: async (payload) => {
      const subscription = payload.subscription;
      if (subscription?.metadata?.userId && subscription?.metadata?.tier) {
        // TODO: Update user membership status to active
        const _tier = subscription.metadata.tier as MembershipTier;
      }
    },

    onSubscriptionCanceled: async (payload) => {
      const subscription = payload.subscription;
      if (subscription?.metadata?.userId) {
      }
    },

    onSubscriptionRevoked: async (payload) => {
      const subscription = payload.subscription;
      if (subscription?.metadata?.userId) {
      }
    },

    onBenefitGrantCreated: async (_payload) => {
      // TODO: Enable specific features for user
    },

    onBenefitGrantRevoked: async (_payload) => {
      // TODO: Disable specific features for user
    },

    onPayload: async (_payload) => {},
  };
}

/**
 * Environment configuration helper
 */
export function getPolarConfigFromEnv(): PolarClientConfig {
  const accessToken = process.env.POLAR_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("POLAR_ACCESS_TOKEN environment variable is required");
  }

  return {
    accessToken,
    server: process.env.NODE_ENV === "production" ? "production" : "sandbox",
  };
}

/**
 * Complete Polar setup for Better Auth
 */
export function setupPolarForBetterAuth(
  customHandlers?: Partial<WebhookHandlers>
) {
  const polarClient = createPolarClient(getPolarConfigFromEnv());
  const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;

  const defaultHandlers = getDefaultWebhookHandlers();
  const handlers = { ...defaultHandlers, ...customHandlers };

  return createPolarPlugin({
    client: polarClient,
    createCustomerOnSignUp: true,
    webhookSecret,
    webhookHandlers: handlers,
    successUrl: process.env.POLAR_SUCCESS_URL ?? POLAR_CONFIG.SUCCESS_URL,
    cancelUrl: process.env.POLAR_CANCEL_URL ?? POLAR_CONFIG.CANCEL_URL,
    authenticatedUsersOnly: true,
  });
}
