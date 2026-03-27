/**
 * Polar Payment Provider Adapter
 */

import type {
  BillingInterval,
  CheckoutResult,
  CreateCheckoutOptions,
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
import { Polar } from "@polar-sh/sdk";

const CENTS_TO_DOLLARS = 100;
const MIN_PRICE_CENTS = 50;
const DEFAULT_LIMIT = 50;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  priceAmount?: number;
  priceCurrency?: string;
  recurringInterval?: string | null;
};

type PolarProductResponse = {
  id: string;
  name: string;
  description?: string | null;
  recurringInterval?: string | null;
  isRecurring?: boolean;
  metadata?: Record<string, unknown> | null;
  prices?: PolarPrice[];
};

function mapPolarProduct(product: PolarProductResponse): Product {
  const price = product.prices?.[0];
  const metadata = (product.metadata ?? {}) as Record<string, unknown>;
  const interval = product.isRecurring
    ? (product.recurringInterval ?? price?.recurringInterval ?? "month")
    : "month";

  return {
    id: product.id,
    name: product.name,
    description: product.description ?? undefined,
    type: product.isRecurring ? "plan" : "product",
    price: {
      amount: (price?.priceAmount ?? 0) / CENTS_TO_DOLLARS,
      currency: (price?.priceCurrency ?? "usd").toUpperCase(),
    },
    interval: mapPolarInterval(interval),
    intervalCount: 1,
    metadata: {
      ...metadata,
      isRecurring: product.isRecurring ?? false,
    },
  };
}

export function createPolarAdapter(
  config: PolarAdapterConfig
): PaymentProviderAdapter {
  const client = new Polar({
    accessToken: config.accessToken,
    server: config.server,
  });

  return {
    provider: "polar",

    async listProducts(): Promise<Product[]> {
      const response = await client.products.list({
        organizationId: config.organizationId,
        isArchived: false,
      });
      const products = Array.isArray(response)
        ? response
        : response.result.items;

      return products.map((product) => mapPolarProduct(product));
    },

    async getProduct(productId: string): Promise<Product | null> {
      try {
        const product = await client.products.get({
          id: productId,
        });
        return mapPolarProduct(product);
      } catch {
        return null;
      }
    },

    async createProduct(options: CreateProductOptions): Promise<Product> {
      const product = await client.products.create({
        name: options.name,
        description: options.description,
        recurringInterval: options.type === "plan" ? options.interval : null,
        prices: [
          {
            amountType: "fixed" as const,
            priceAmount: Math.max(
              Math.round(options.price.amount * CENTS_TO_DOLLARS),
              MIN_PRICE_CENTS
            ),
            priceCurrency: options.price.currency.toLowerCase(),
          },
        ],
        metadata: options.metadata as
          | Record<string, string | number | boolean>
          | undefined,
      });

      return mapPolarProduct(product);
    },

    async updateProduct(
      productId: string,
      options: UpdateProductOptions
    ): Promise<Product> {
      const productUpdate: Record<string, unknown> = {};

      if (options.name !== undefined) {
        productUpdate.name = options.name;
      }
      if (options.description !== undefined) {
        productUpdate.description = options.description;
      }
      if (options.metadata !== undefined) {
        productUpdate.metadata = options.metadata;
      }
      if (options.status !== undefined) {
        productUpdate.isArchived = options.status === "inactive";
      }
      if (options.price !== undefined) {
        productUpdate.prices = [
          {
            amountType: "fixed" as const,
            priceAmount: Math.max(
              Math.round(options.price.amount * CENTS_TO_DOLLARS),
              MIN_PRICE_CENTS
            ),
            priceCurrency: options.price.currency.toLowerCase(),
          },
        ];
      }

      const product = await client.products.update({
        id: productId,
        productUpdate,
      });

      return mapPolarProduct(product);
    },

    async deleteProduct(productId: string): Promise<void> {
      // Polar does not support hard deletes; archive the product instead
      await client.products.update({
        id: productId,
        productUpdate: { isArchived: true },
      });
    },

    async createCheckout(
      options: CreateCheckoutOptions
    ): Promise<CheckoutResult> {
      const checkout = await client.checkouts.create({
        products: [options.productId],
        successUrl: options.successUrl,
        externalCustomerId: options.customerId,
        customerEmail: options.customerEmail,
        metadata: options.metadata as
          | Record<string, string | number | boolean>
          | undefined,
      });

      return {
        id: checkout.id,
        url: checkout.url,
      };
    },

    async createSubscription(
      options: CreateSubscriptionOptions
    ): Promise<Subscription> {
      if (!options.productId) {
        throw new Error("productId is required for Polar subscriptions");
      }

      const checkout = await client.checkouts.create({
        products: [options.productId],
        successUrl: config.successUrl,
        externalCustomerId: options.customerId,
        customerEmail: options.customerEmail,
        metadata: options.metadata as
          | Record<string, string | number | boolean>
          | undefined,
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

    async getSubscription(
      subscriptionId: string
    ): Promise<Subscription | null> {
      try {
        const sub = await client.subscriptions.get({
          id: subscriptionId,
        });
        return {
          id: sub.id,
          status: mapPolarStatus(sub.status),
          productId: sub.productId,
          productName: sub.product?.name,
          customerId: sub.customerId,
          customerEmail: sub.customer?.email,
          currentPeriodStart: sub.currentPeriodStart
            ? new Date(sub.currentPeriodStart)
            : undefined,
          currentPeriodEnd: sub.currentPeriodEnd
            ? new Date(sub.currentPeriodEnd)
            : undefined,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd ?? undefined,
          metadata: sub.metadata as Record<string, unknown> | undefined,
        };
      } catch {
        return null;
      }
    },

    async updateSubscription(
      subscriptionId: string,
      options: UpdateSubscriptionOptions
    ): Promise<Subscription> {
      const updated = await client.subscriptions.update({
        id: subscriptionId,
        subscriptionUpdate: {
          productId: options.productId as string,
          prorationBehavior:
            options.prorationBehavior === "none"
              ? undefined
              : options.prorationBehavior,
        },
      });

      return {
        id: updated.id,
        status: mapPolarStatus(updated.status),
        productId: updated.productId ?? "",
        productName: updated.product?.name,
        customerId: updated.customerId,
        currentPeriodEnd: updated.currentPeriodEnd
          ? new Date(updated.currentPeriodEnd)
          : undefined,
        cancelAtPeriodEnd: updated.cancelAtPeriodEnd ?? undefined,
        metadata: updated.metadata as Record<string, unknown> | undefined,
      };
    },

    async cancelSubscription(
      subscriptionId: string,
      immediately = false
    ): Promise<Subscription> {
      const canceled = await client.subscriptions.update({
        id: subscriptionId,
        subscriptionUpdate: {
          cancelAtPeriodEnd: !immediately,
        },
      });

      return {
        id: canceled.id,
        status: immediately ? "canceled" : mapPolarStatus(canceled.status),
        productId: canceled.productId,
        customerId: canceled.customerId,
        currentPeriodEnd: canceled.currentPeriodEnd
          ? new Date(canceled.currentPeriodEnd)
          : undefined,
        cancelAtPeriodEnd: !immediately,
        metadata: canceled.metadata as Record<string, unknown> | undefined,
      };
    },

    async listSubscriptions(
      options: ListSubscriptionsOptions
    ): Promise<Subscription[]> {
      let customerId = isUuid(options.customerId)
        ? options.customerId
        : undefined;
      const externalCustomerId =
        options.customerId && !isUuid(options.customerId)
          ? options.customerId
          : undefined;

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
        customerId,
        externalCustomerId,
        limit: options.limit ?? DEFAULT_LIMIT,
      });

      const subscriptions = response.result.items.map((sub) => ({
        id: sub.id,
        status: mapPolarStatus(sub.status),
        productId: sub.productId,
        productName: sub.product?.name,
        customerId: sub.customer?.externalId ?? sub.customerId,
        customerEmail: sub.customer?.email,
        currentPeriodStart: sub.currentPeriodStart
          ? new Date(sub.currentPeriodStart)
          : undefined,
        currentPeriodEnd: sub.currentPeriodEnd
          ? new Date(sub.currentPeriodEnd)
          : undefined,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd ?? undefined,
        metadata: sub.metadata as Record<string, unknown> | undefined,
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
      metadata?: Record<string, unknown>
    ): Promise<Customer> {
      const customer = await client.customers.create({
        email,
        metadata: metadata as
          | Record<string, string | number | boolean>
          | undefined,
      });

      return {
        id: customer.id,
        email: customer.email,
        name: customer.name ?? undefined,
        externalId: customer.externalId ?? undefined,
        metadata: customer.metadata as Record<string, unknown> | undefined,
      };
    },

    async getCustomer(customerId: string): Promise<Customer | null> {
      try {
        const customer = await client.customers.get({
          id: customerId,
        });
        return {
          id: customer.id,
          email: customer.email,
          name: customer.name ?? undefined,
          externalId: customer.externalId ?? undefined,
          metadata: customer.metadata as Record<string, unknown> | undefined,
        };
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
        const customer = response.result.items[0];
        if (!customer) {
          return null;
        }
        return {
          id: customer.id,
          email: customer.email,
          name: customer.name ?? undefined,
          externalId: customer.externalId ?? undefined,
          metadata: customer.metadata as Record<string, unknown> | undefined,
        };
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

    async createPortalSession(
      customerId: string,
      _returnUrl: string
    ): Promise<string> {
      const session = await client.customerSessions.create({
        customerId,
      });
      return session.customerPortalUrl;
    },
  };
}

/**
 * Factory function matching the ProviderAdapterFactory signature.
 * Used by the core factory registry.
 */
export function createAdapter(
  config: Record<string, string>
): PaymentProviderAdapter {
  return createPolarAdapter({
    accessToken: config.POLAR_ACCESS_TOKEN ?? "",
    server: (config.POLAR_SERVER ?? "sandbox") as "sandbox" | "production",
    organizationId: config.POLAR_ORGANIZATION_ID ?? "",
    successUrl: config.PAYMENTS_SUCCESS_URL ?? config.POLAR_SUCCESS_URL ?? "",
    cancelUrl: config.PAYMENTS_CANCEL_URL ?? config.POLAR_CANCEL_URL,
  });
}
