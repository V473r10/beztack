/**
 * Unified Payment Provider Types
 *
 * Re-exports from @beztack/payments for backwards compatibility.
 * New code should import directly from @beztack/payments.
 */
export type {
  BillingInterval,
  CheckoutResult,
  CreateCheckoutOptions,
  CreateSubscriptionOptions,
  Customer,
  ListSubscriptionsOptions,
  PaymentProviderAdapter,
  PaymentProviderName,
  PaymentProviderName as PaymentProvider,
  Product,
  Subscription,
  SubscriptionStatus,
  UpdateSubscriptionOptions,
  WebhookEventType,
  WebhookPayload,
} from "@beztack/payments";
