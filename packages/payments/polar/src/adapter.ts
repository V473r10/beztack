/**
 * Polar Payment Provider Adapter
 */

import type {
  BillingInterval,
  CheckoutResult,
  CreateCheckoutOptions,
  CreateCustomerOptions,
  CreateProductOptions,
  CreateSubscriptionOptions,
  Customer,
  ListSubscriptionsOptions,
  PaymentProviderAdapter,
  Product,
  Subscription,
  SubscriptionStatus,
  UpdateProductOptions,
  UpdateSubscriptionOptions,
  WebhookPayload,
} from "@beztack/payments";
import { SubscriptionUpdateNotAppliedError } from "@beztack/payments";
import { createPolar } from "@polar-sh/sdk/2026-10";

type PolarClient = ReturnType<typeof createPolar>;
type PolarSubscription = Awaited<ReturnType<PolarClient["subscriptions"]["get"]>>;
type PolarCustomer = Awaited<ReturnType<PolarClient["customers"]["get"]>>;
type PolarFixedPriceCreate = Extract<
  Parameters<PolarClient["products"]["create"]>[0]["prices"][number],
  { amount_type: "fixed" }
>;
type PresentmentCurrency = NonNullable<PolarFixedPriceCreate["price_currency"]>;
type PolarProductUpdate = Parameters<PolarClient["products"]["update"]>[1];
type PolarRecurringInterval = NonNullable<PolarProductUpdate["recurring_interval"]>;

const CENTS_TO_DOLLARS = 100;
const MIN_PRICE_CENTS = 50;
const DEFAULT_LIMIT = 50;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function maskEmail(email?: string): string | undefined {
  if (!email) {
    return;
  }

  const [localPart, domain] = email.split("@");

  if (!(localPart && domain)) {
    return "***";
  }

  const visibleLocalPart = localPart.slice(0, 2);

  return `${visibleLocalPart}***@${domain}`;
}

function isUuid(value?: string): boolean {
  if (!value) {
    return false;
  }

  return UUID_REGEX.test(value);
}

function mapPolarStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "active":
      return "active";
    case "canceled":
      return "canceled";
    case "past_due":
      return "past_due";
    case "incomplete":
    case "incomplete_expired":
      return "pending";
    case "paused":
      return "paused";
    default:
      return "inactive";
  }
}

function mapPolarInterval(interval: string): BillingInterval {
  switch (interval) {
    case "month":
      return "month";
    case "year":
      return "year";
    case "week":
      return "week";
    case "day":
      return "day";
    default:
      return "month";
  }
}

export type PolarAdapterConfig = {
  accessToken: string;
  server: "sandbox" | "production";
  organizationId: string;
  successUrl: string;
  cancelUrl?: string;
};

type PolarPrice = {
  price_amount?: number;
  price_currency?: string;
  recurring_interval?: string | null;
};

type PolarProductResponse = {
  id: string;
  name: string;
  description?: string | null;
  recurring_interval?: string | null;
  is_recurring?: boolean;
  metadata?: Record<string, unknown> | null;
  prices?: PolarPrice[];
};

function mapPolarProduct(product: PolarProductResponse): Product {
  const price = product.prices?.[0];
  const metadata = (product.metadata ?? {}) as Record<string, unknown>;
  const interval = product.is_recurring
    ? (product.recurring_interval ?? price?.recurring_interval ?? "month")
    : "month";

  return {
    id: product.id,
    name: product.name,
    description: product.description ?? undefined,
    type: product.is_recurring ? "plan" : "product",
    price: {
      amount: (price?.price_amount ?? 0) / CENTS_TO_DOLLARS,
      currency: (price?.price_currency ?? "usd").toUpperCase(),
    },
    interval: mapPolarInterval(interval),
    intervalCount: 1,
    metadata: {
      ...metadata,
      isRecurring: product.is_recurring ?? false,
    },
  };
}

function mapPolarSubscription(sub: PolarSubscription): Subscription {
  return {
    id: sub.id,
    status: mapPolarStatus(sub.status),
    productId: sub.product_id,
    productName: sub.product?.name,
    customerId: sub.customer_id,
    customerEmail: sub.customer?.email ?? undefined,
    currentPeriodStart: sub.current_period_start ? new Date(sub.current_period_start) : undefined,
    currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end) : undefined,
    cancelAtPeriodEnd: sub.cancel_at_period_end ?? undefined,
    metadata: sub.metadata as Record<string, unknown> | undefined,
  };
}

function mapPolarCustomer(customer: PolarCustomer): Customer {
  return {
    id: customer.id,
    email: customer.email ?? "",
    name: customer.name ?? undefined,
    externalId: customer.external_id ?? undefined,
    metadata: customer.metadata as Record<string, unknown> | undefined,
  };
}

function fixedPrice(price: { amount: number; currency: string }): PolarFixedPriceCreate {
  return {
    amount_type: "fixed",
    price_amount: Math.max(Math.round(price.amount * CENTS_TO_DOLLARS), MIN_PRICE_CENTS),
    price_currency: price.currency.toLowerCase() as PresentmentCurrency,
  };
}

export function createPolarAdapter(config: PolarAdapterConfig): PaymentProviderAdapter {
  const client = createPolar({
    accessToken: config.accessToken,
    environment: config.server,
  });

  return {
    provider: "polar",
    capabilities: { cadenceChange: true },

    async listProducts(): Promise<Product[]> {
      const response = await client.products.list({
        organization_id: config.organizationId,
        is_archived: false,
      });

      return response.items.map((product) => mapPolarProduct(product as PolarProductResponse));
    },

    async getProduct(productId: string): Promise<Product | null> {
      try {
        const product = await client.products.get(productId);
        return mapPolarProduct(product as PolarProductResponse);
      } catch {
        return null;
      }
    },

    async createProduct(options: CreateProductOptions): Promise<Product> {
      const base = {
        name: options.name,
        description: options.description,
        prices: [fixedPrice(options.price)],
        metadata: options.metadata as Record<string, string | number | boolean> | undefined,
      };
      const product = await client.products.create(
        options.type === "plan"
          ? { ...base, recurring_interval: options.interval as PolarRecurringInterval }
          : { ...base, recurring_interval: null },
      );

      return mapPolarProduct(product as PolarProductResponse);
    },

    async updateProduct(productId: string, options: UpdateProductOptions): Promise<Product> {
      const productUpdate: PolarProductUpdate = {};

      if (options.name !== undefined) {
        productUpdate.name = options.name;
      }
      if (options.description !== undefined) {
        productUpdate.description = options.description;
      }
      if (options.metadata !== undefined) {
        productUpdate.metadata = options.metadata as Record<string, string | number | boolean>;
      }
      if (options.status !== undefined) {
        productUpdate.is_archived = options.status === "inactive";
      }
      if (options.price !== undefined) {
        productUpdate.prices = [fixedPrice(options.price)];
      }

      const product = await client.products.update(productId, productUpdate);

      return mapPolarProduct(product as PolarProductResponse);
    },

    async deleteProduct(productId: string): Promise<void> {
      // Polar does not support hard deletes; archive the product instead
      await client.products.update(productId, { is_archived: true });
    },

    async createCheckout(options: CreateCheckoutOptions): Promise<CheckoutResult> {
      const checkout = await client.checkouts.create({
        products: [options.productId],
        success_url: options.successUrl,
        external_customer_id: options.customerId,
        customer_email: options.customerEmail,
        metadata: options.metadata as Record<string, string | number | boolean> | undefined,
      });

      return {
        id: checkout.id,
        url: checkout.url,
      };
    },

    async createSubscription(options: CreateSubscriptionOptions): Promise<Subscription> {
      if (!options.productId) {
        throw new Error("productId is required for Polar subscriptions");
      }

      const checkout = await client.checkouts.create({
        products: [options.productId],
        success_url: config.successUrl,
        external_customer_id: options.customerId,
        customer_email: options.customerEmail,
        metadata: options.metadata as Record<string, string | number | boolean> | undefined,
      });

      return {
        id: checkout.id,
        status: "pending",
        productId: options.productId,
        customerId: "",
        customerEmail: options.customerEmail,
        metadata: options.metadata,
      };
    },

    async getSubscription(subscriptionId: string): Promise<Subscription | null> {
      try {
        return mapPolarSubscription(await client.subscriptions.get(subscriptionId));
      } catch {
        return null;
      }
    },

    async updateSubscription(
      subscriptionId: string,
      options: UpdateSubscriptionOptions,
    ): Promise<Subscription> {
      const updated = await client.subscriptions.update(subscriptionId, {
        product_id: options.productId as string,
        proration_behavior:
          options.prorationBehavior === "none" ? undefined : options.prorationBehavior,
      });

      if (options.productId && updated.product_id !== options.productId) {
        throw new SubscriptionUpdateNotAppliedError(
          subscriptionId,
          `Polar kept the Subscription on ${updated.product_id} instead of ${options.productId}`,
        );
      }

      return mapPolarSubscription(updated);
    },

    async cancelSubscription(subscriptionId: string, immediately = false): Promise<Subscription> {
      const canceled = await client.subscriptions.update(subscriptionId, {
        cancel_at_period_end: !immediately,
      });

      return {
        ...mapPolarSubscription(canceled),
        status: immediately ? "canceled" : mapPolarStatus(canceled.status),
        cancelAtPeriodEnd: !immediately,
      };
    },

    async listSubscriptions(options: ListSubscriptionsOptions): Promise<Subscription[]> {
      let customerId = isUuid(options.customerId) ? options.customerId : undefined;
      const externalCustomerId =
        options.customerId && !isUuid(options.customerId) ? options.customerId : undefined;

      // biome-ignore lint/suspicious/noConsole: Debugging subscription listing flow
      console.log("[PolarAdapter] listSubscriptions:start", {
        customerId: customerId ?? null,
        externalCustomerId: externalCustomerId ?? null,
        customerEmail: maskEmail(options.customerEmail),
        limit: options.limit ?? DEFAULT_LIMIT,
        requestedStatus: options.status ?? null,
        requestedOffset: options.offset ?? null,
      });

      if (!(customerId || externalCustomerId) && options.customerEmail) {
        // biome-ignore lint/suspicious/noConsole: Debugging customer resolution for subscription listing
        console.log("[PolarAdapter] listSubscriptions:resolve-customer", {
          customerEmail: maskEmail(options.customerEmail),
        });

        const customer = await this.getCustomerByEmail(options.customerEmail);
        if (!customer) {
          // biome-ignore lint/suspicious/noConsole: Debugging empty subscription results when customer is missing
          console.log("[PolarAdapter] listSubscriptions:customer-not-found", {
            customerEmail: maskEmail(options.customerEmail),
          });

          return [];
        }
        customerId = customer.id;

        // biome-ignore lint/suspicious/noConsole: Debugging resolved customer used to list subscriptions
        console.log("[PolarAdapter] listSubscriptions:customer-resolved", {
          customerId,
          customerEmail: maskEmail(customer.email),
        });
      }

      if (!customerId) {
        if (externalCustomerId) {
          // biome-ignore lint/suspicious/noConsole: Debugging listSubscriptions lookup by external customer id
          console.log("[PolarAdapter] listSubscriptions:using-external-id", {
            externalCustomerId,
          });
        } else {
          // biome-ignore lint/suspicious/noConsole: Debugging invalid listSubscriptions calls without customer identifiers
          console.log("[PolarAdapter] listSubscriptions:missing-customer", {
            customerEmail: maskEmail(options.customerEmail),
          });

          return [];
        }
      }

      if (options.status || options.offset) {
        // biome-ignore lint/suspicious/noConsole: Debugging unsupported filters in Polar subscription listing
        console.log("[PolarAdapter] listSubscriptions:ignored-filters", {
          requestedStatus: options.status ?? null,
          requestedOffset: options.offset ?? null,
        });
      }

      const response = await client.subscriptions.list({
        customer_id: customerId,
        external_customer_id: externalCustomerId,
        limit: options.limit ?? DEFAULT_LIMIT,
      });

      const subscriptions = response.items.map((sub) => ({
        ...mapPolarSubscription(sub),
        customerId: sub.customer?.external_id ?? sub.customer_id,
      }));

      // biome-ignore lint/suspicious/noConsole: Debugging Polar subscription list response
      console.log("[PolarAdapter] listSubscriptions:success", {
        customerId,
        externalCustomerId,
        count: subscriptions.length,
        subscriptions: subscriptions.map((subscription) => ({
          id: subscription.id,
          status: subscription.status,
          productId: subscription.productId,
          currentPeriodEnd: subscription.currentPeriodEnd?.toISOString(),
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd ?? false,
        })),
      });

      return subscriptions;
    },

    async createCustomer(
      email: string,
      metadata?: Record<string, unknown>,
      options?: CreateCustomerOptions,
    ): Promise<Customer> {
      const customer = await client.customers.create({
        email,
        name: options?.name,
        external_id: options?.externalId,
        metadata: metadata as Record<string, string | number | boolean> | undefined,
      });

      return mapPolarCustomer(customer);
    },

    async getCustomer(customerId: string): Promise<Customer | null> {
      try {
        return mapPolarCustomer(await client.customers.get(customerId));
      } catch {
        return null;
      }
    },

    async getCustomerByEmail(email: string): Promise<Customer | null> {
      try {
        const response = await client.customers.list({
          email,
          limit: 1,
        });
        const customer = response.items[0];
        if (!customer) {
          return null;
        }
        return mapPolarCustomer(customer);
      } catch {
        return null;
      }
    },

    parseWebhook(rawBody: string, _signature: string): Promise<WebhookPayload> {
      const payload = JSON.parse(rawBody) as {
        type: string;
        data?: {
          subscription?: Subscription;
          customer?: Customer;
        };
      };
      const eventType = payload.type;

      let mappedType: WebhookPayload["type"] = "subscription.updated";
      if (eventType.includes("subscription.active")) {
        mappedType = "subscription.active";
      } else if (eventType.includes("subscription.canceled")) {
        mappedType = "subscription.canceled";
      } else if (eventType.includes("order.paid")) {
        mappedType = "payment.success";
      } else if (eventType.includes("customer.created")) {
        mappedType = "customer.created";
      }

      return Promise.resolve({
        type: mappedType,
        provider: "polar",
        subscription: payload.data?.subscription,
        customer: payload.data?.customer,
        rawPayload: payload,
      });
    },

    async createPortalSession(customerId: string, _returnUrl: string): Promise<string> {
      const session = await client.customerSessions.create({
        customer_id: customerId,
      });
      return session.customer_portal_url;
    },
  };
}

/**
 * Factory function matching the ProviderAdapterFactory signature.
 * Used by the core factory registry.
 */
export function createAdapter(config: Record<string, string>): PaymentProviderAdapter {
  return createPolarAdapter({
    accessToken: config.POLAR_ACCESS_TOKEN ?? "",
    server: (config.POLAR_SERVER ?? "sandbox") as "sandbox" | "production",
    organizationId: config.POLAR_ORGANIZATION_ID ?? "",
    successUrl: config.PAYMENTS_SUCCESS_URL ?? config.POLAR_SUCCESS_URL ?? "",
    cancelUrl: config.PAYMENTS_CANCEL_URL ?? config.POLAR_CANCEL_URL,
  });
}
