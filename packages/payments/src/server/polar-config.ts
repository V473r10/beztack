import { polar, checkout, portal, usage, webhooks } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";
import type { BetterAuthOptions } from "better-auth";
import { MEMBERSHIP_TIERS, POLAR_CONFIG } from "../constants/index.ts";
import type { MembershipTier } from "../types/index.ts";

/**
 * Polar client configuration
 */
export interface PolarClientConfig {
  accessToken: string;
  server?: "production" | "sandbox";
}

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
export interface WebhookHandlers {
  onCustomerStateChanged?: (payload: any) => Promise<void> | void;
  onOrderPaid?: (payload: any) => Promise<void> | void;
  onSubscriptionCreated?: (payload: any) => Promise<void> | void;
  onSubscriptionUpdated?: (payload: any) => Promise<void> | void;
  onSubscriptionActive?: (payload: any) => Promise<void> | void;
  onSubscriptionCanceled?: (payload: any) => Promise<void> | void;
  onSubscriptionRevoked?: (payload: any) => Promise<void> | void;
  onCheckoutCreated?: (payload: any) => Promise<void> | void;
  onCheckoutUpdated?: (payload: any) => Promise<void> | void;
  onBenefitGrantCreated?: (payload: any) => Promise<void> | void;
  onBenefitGrantUpdated?: (payload: any) => Promise<void> | void;
  onBenefitGrantRevoked?: (payload: any) => Promise<void> | void;
  onPayload?: (payload: any) => Promise<void> | void;
}

/**
 * Polar plugin configuration
 */
export interface PolarPluginConfig {
  client: Polar;
  createCustomerOnSignUp?: boolean;
  getCustomerCreateParams?: (
    user: { id: string; email: string; name?: string },
    request: Request
  ) => {
    metadata?: Record<string, any>;
  };
  webhookSecret?: string;
  webhookHandlers?: WebhookHandlers;
  successUrl?: string;
  cancelUrl?: string;
  authenticatedUsersOnly?: boolean;
}

/**
 * Create Polar Better Auth plugin with full configuration
 */
export function createPolarPlugin(config: PolarPluginConfig) {
  const products = Object.values(MEMBERSHIP_TIERS)
    .filter(tier => tier.polarProductId)
    .map(tier => ({
      productId: tier.polarProductId!,
      slug: tier.id,
    }));

  return polar({
    client: config.client,
    createCustomerOnSignUp: config.createCustomerOnSignUp ?? true,
    getCustomerCreateParams: config.getCustomerCreateParams ?? (({ user }) => ({
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
      ...(config.webhookSecret && config.webhookHandlers ? [
        webhooks({
          secret: config.webhookSecret,
          ...config.webhookHandlers,
        })
      ] : []),
    ],
  });
}

// Import default handlers from webhooks module (avoiding duplicate definition)
function getDefaultWebhookHandlers(): WebhookHandlers {
  return {
    onCustomerStateChanged: async (payload) => {
      console.log("Customer state changed:", payload.customer?.id);
      // TODO: Update user membership in database
    },

    onOrderPaid: async (payload) => {
      console.log("Order paid:", payload.order?.id);
      const order = payload.order;
      if (order?.metadata?.userId && order?.metadata?.tier) {
        // TODO: Activate membership for user
        console.log(`Activating ${order.metadata.tier} membership for user ${order.metadata.userId}`);
      }
    },

    onSubscriptionActive: async (payload) => {
      console.log("Subscription activated:", payload.subscription?.id);
      const subscription = payload.subscription;
      if (subscription?.metadata?.userId && subscription?.metadata?.tier) {
        // TODO: Update user membership status to active
        console.log(`Subscription ${subscription.id} activated for user ${subscription.metadata.userId}`);
      }
    },

    onSubscriptionCanceled: async (payload) => {
      console.log("Subscription canceled:", payload.subscription?.id);
      const subscription = payload.subscription;
      if (subscription?.metadata?.userId) {
        // TODO: Update user membership status to canceled
        console.log(`Subscription ${subscription.id} canceled for user ${subscription.metadata.userId}`);
      }
    },

    onSubscriptionRevoked: async (payload) => {
      console.log("Subscription revoked:", payload.subscription?.id);
      const subscription = payload.subscription;
      if (subscription?.metadata?.userId) {
        // TODO: Immediately revoke user access
        console.log(`Subscription ${subscription.id} revoked for user ${subscription.metadata.userId}`);
      }
    },

    onBenefitGrantCreated: async (payload) => {
      console.log("Benefit granted:", payload.benefitGrant?.id);
      // TODO: Enable specific features for user
    },

    onBenefitGrantRevoked: async (payload) => {
      console.log("Benefit revoked:", payload.benefitGrant?.id);
      // TODO: Disable specific features for user
    },

    onPayload: async (payload) => {
      console.log("Polar webhook received:", payload.type);
    },
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
export function setupPolarForBetterAuth(customHandlers?: Partial<WebhookHandlers>) {
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