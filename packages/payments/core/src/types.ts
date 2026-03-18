/**
 * @beztack/payments — Provider-agnostic payment types
 *
 * All payment providers must implement the PaymentProviderAdapter interface.
 * Apps should only import types from this package, never from provider packages.
 */

export type PaymentProviderName = "polar" | "mercadopago";

export type SubscriptionStatus = "authorized" | "cancelled" | "paused";

export type BillingInterval = "month" | "year" | "day" | "week";

/**
 * Product type discriminator:
 * - "product" = one-time purchase
 * - "plan" = recurring subscription
 */
export type ProductType = "product" | "plan";

/**
 * Unified Product/Plan representation
 */
export type Product = {
  id: string;
  name: string;
  description?: string;
  type: ProductType;
  price: {
    amount: number;
    currency: string;
  };
  interval: BillingInterval;
  intervalCount: number;
  metadata?: Record<string, unknown>;
};

/**
 * A Plan is a Product that represents a recurring subscription.
 */
export type Plan = Product & { type: "plan" };

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
 * Product creation options
 */
export type CreateProductOptions = {
  name: string;
  description?: string;
  type: ProductType;
  price: { amount: number; currency: string };
  interval: BillingInterval;
  intervalCount: number;
  metadata?: Record<string, unknown>;
};

/**
 * Product update options
 */
export type UpdateProductOptions = {
  name?: string;
  description?: string;
  price?: { amount: number; currency: string };
  interval?: BillingInterval;
  intervalCount?: number;
  metadata?: Record<string, unknown>;
  status?: "active" | "inactive";
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
  provider: PaymentProviderName;
  subscription?: Subscription;
  customer?: Customer;
  rawPayload: unknown;
};

/**
 * Webhook payload handler function type
 */
export type WebhookPayloadHandler = (
  payload: WebhookPayloadData
) => Promise<void>;

/**
 * Generic webhook payload data
 */
export type WebhookPayloadData = {
  customer?: Customer;
  order?: {
    id?: string;
    customerId?: string;
    metadata?: Record<string, unknown>;
  };
  subscription?: Subscription;
  [key: string]: unknown;
};

/**
 * Membership update data (emitted by webhook handlers)
 */
export type MembershipUpdate = {
  userId: string;
  tier: string;
  status: "active" | "inactive" | "canceled" | "past_due";
  subscriptionId?: string;
  organizationId?: string;
  validUntil?: Date;
};

/**
 * Payment Provider Interface
 * All payment providers must implement this interface
 */
export type PaymentProviderAdapter = {
  readonly provider: PaymentProviderName;

  // Products/Plans
  listProducts(): Promise<Product[]>;
  getProduct(productId: string): Promise<Product | null>;
  createProduct(options: CreateProductOptions): Promise<Product>;
  updateProduct(
    productId: string,
    options: UpdateProductOptions
  ): Promise<Product>;
  deleteProduct(productId: string): Promise<void>;

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

/**
 * Pricing tier for UI display (provider-agnostic)
 */
export type PricingTier = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly price: {
    readonly monthly: number;
    readonly yearly: number;
  };
  readonly monthly?: ProviderProduct;
  readonly yearly?: ProviderProduct;
  readonly features?: readonly string[];
  readonly limits?: Record<string, number>;
  readonly permissions?: Record<string, boolean>;
  readonly displayOrder?: number;
  readonly yearlySavingsPercent?: number;
};

/**
 * Provider product structure (generic version of Polar/MP product)
 */
export type ProviderProduct = {
  id: string;
  name: string;
  description?: string | null;
  recurringInterval: string;
  metadata?: {
    frequency?: string;
    [key: string]: unknown;
  };
  prices: Array<{
    id: string;
    priceAmount: number;
    priceCurrency: string;
    recurringInterval: string;
  }>;
  benefits?: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
};

/**
 * Provider adapter factory function signature
 */
export type ProviderAdapterFactory = (
  config: Record<string, string>
) => PaymentProviderAdapter;
