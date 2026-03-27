/**
 * @beztack/payments — Provider-agnostic payment abstraction
 *
 * Apps should import from this package only, never from provider packages directly.
 */

// Factory
export {
  createPaymentProvider,
  getPaymentProvider,
  getRegisteredProviders,
  resetPaymentProvider,
} from "./factory.js";
// Types
export type {
  BillingInterval,
  CheckoutResult,
  CreateCheckoutOptions,
  CreateProductOptions,
  CreateSubscriptionOptions,
  Customer,
  ListSubscriptionsOptions,
  MembershipUpdate,
  PaymentProviderAdapter,
  PaymentProviderName,
  Plan,
  PricingTier,
  Product,
  ProductType,
  ProviderAdapterFactory,
  ProviderProduct,
  Subscription,
  SubscriptionStatus,
  UpdateProductOptions,
  UpdateSubscriptionOptions,
  WebhookEventType,
  WebhookPayload,
  WebhookPayloadData,
  WebhookPayloadHandler,
} from "./types.js";

// Webhook utilities
export {
  createDefaultWebhookHandlers,
  verifyWebhookSignature,
} from "./webhooks.js";
