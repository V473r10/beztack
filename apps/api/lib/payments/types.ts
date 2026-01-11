/**
 * Unified Payment Provider Types
 * Abstract interface for payment/subscription providers (Polar, Mercado Pago, etc.)
 */

export type PaymentProvider = "polar" | "mercadopago";

export type SubscriptionStatus =
  | "active"
  | "inactive"
  | "pending"
  | "canceled"
  | "paused"
  | "past_due";

export type BillingInterval = "month" | "year" | "day" | "week";

/**
 * Unified Product/Plan representation
 */
export type Product = {
  id: string;
  name: string;
  description?: string;
  price: {
    amount: number;
    currency: string;
  };
  interval: BillingInterval;
  intervalCount: number;
  metadata?: Record<string, unknown>;
};

/**
 * Unified Subscription representation
 */
export type Subscription = {
  id: string;
  status: SubscriptionStatus;
  productId: string;
  productName?: string;
  customerId: string;
  customerEmail?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  metadata?: Record<string, unknown>;
};

/**
 * Unified Customer representation
 */
export type Customer = {
  id: string;
  email: string;
  name?: string;
  externalId?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Checkout session creation options
 */
export type CreateCheckoutOptions = {
  productId: string;
  customerEmail?: string;
  customerId?: string;
  successUrl: string;
  cancelUrl?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Checkout session result
 */
export type CheckoutResult = {
  id: string;
  url: string;
};

/**
 * Subscription creation options
 */
export type CreateSubscriptionOptions = {
  productId?: string;
  customerId?: string;
  customerEmail: string;
  paymentMethodId?: string;
  metadata?: Record<string, unknown>;
  backUrl?: string;
  // For custom subscriptions without a plan
  customPlan?: {
    reason: string;
    amount: number;
    currency: string;
    interval: BillingInterval;
    intervalCount: number;
  };
};

/**
 * Subscription update options
 */
export type UpdateSubscriptionOptions = {
  productId?: string;
  cancelAtPeriodEnd?: boolean;
  status?: "pause" | "resume" | "cancel";
  prorationBehavior?: "invoice" | "prorate" | "none";
};

/**
 * List subscriptions options
 */
export type ListSubscriptionsOptions = {
  customerId?: string;
  customerEmail?: string;
  status?: SubscriptionStatus;
  limit?: number;
  offset?: number;
};

/**
 * Webhook event types (unified across providers)
 */
export type WebhookEventType =
  | "subscription.created"
  | "subscription.active"
  | "subscription.updated"
  | "subscription.canceled"
  | "subscription.paused"
  | "subscription.past_due"
  | "payment.success"
  | "payment.failed"
  | "customer.created"
  | "customer.updated";

/**
 * Unified webhook payload
 */
export type WebhookPayload = {
  type: WebhookEventType;
  provider: PaymentProvider;
  subscription?: Subscription;
  customer?: Customer;
  rawPayload: unknown;
};

/**
 * Payment Provider Interface
 * All payment providers must implement this interface
 */
export type PaymentProviderAdapter = {
  readonly provider: PaymentProvider;

  // Products/Plans
  listProducts(): Promise<Product[]>;
  getProduct(productId: string): Promise<Product | null>;

  // Checkout
  createCheckout(options: CreateCheckoutOptions): Promise<CheckoutResult>;

  // Subscriptions
  createSubscription(options: CreateSubscriptionOptions): Promise<Subscription>;
  getSubscription(subscriptionId: string): Promise<Subscription | null>;
  updateSubscription(
    subscriptionId: string,
    options: UpdateSubscriptionOptions
  ): Promise<Subscription>;
  cancelSubscription(
    subscriptionId: string,
    immediately?: boolean
  ): Promise<Subscription>;
  listSubscriptions(options: ListSubscriptionsOptions): Promise<Subscription[]>;

  // Customers
  createCustomer(
    email: string,
    metadata?: Record<string, unknown>
  ): Promise<Customer>;
  getCustomer(customerId: string): Promise<Customer | null>;
  getCustomerByEmail(email: string): Promise<Customer | null>;

  // Webhooks
  parseWebhook(rawBody: string, signature: string): Promise<WebhookPayload>;

  // Portal (if supported)
  createPortalSession?(customerId: string, returnUrl: string): Promise<string>;
};
