/**
 * Polar Payment Provider Adapter
 */
import { Polar } from "@polar-sh/sdk";
import type {
  BillingInterval,
  CheckoutResult,
  CreateCheckoutOptions,
  CreateSubscriptionOptions,
  Customer,
  ListSubscriptionsOptions,
  PaymentProviderAdapter,
  Product,
  Subscription,
  SubscriptionStatus,
  UpdateSubscriptionOptions,
  WebhookPayload,
} from "../types";

const CENTS_TO_DOLLARS = 100;
const DEFAULT_LIMIT = 50;

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

export function createPolarAdapter(config: {
  accessToken: string;
  server: "sandbox" | "production";
  organizationId: string;
  successUrl: string;
  cancelUrl?: string;
}): PaymentProviderAdapter {
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

      return response.result.items.map((product) => {
        const price = product.prices[0] as
          | { priceAmount?: number; priceCurrency?: string }
          | undefined;
        return {
          id: product.id,
          name: product.name,
          description: product.description ?? undefined,
          price: {
            amount: (price?.priceAmount ?? 0) / CENTS_TO_DOLLARS,
            currency: price?.priceCurrency ?? "USD",
          },
          interval: mapPolarInterval(product.recurringInterval ?? "month"),
          intervalCount: 1,
          metadata: product.metadata as Record<string, unknown> | undefined,
        };
      });
    },

    async getProduct(productId: string): Promise<Product | null> {
      try {
        const product = await client.products.get({ id: productId });
        const price = product.prices[0] as
          | { priceAmount?: number; priceCurrency?: string }
          | undefined;
        return {
          id: product.id,
          name: product.name,
          description: product.description ?? undefined,
          price: {
            amount: (price?.priceAmount ?? 0) / CENTS_TO_DOLLARS,
            currency: price?.priceCurrency ?? "USD",
          },
          interval: mapPolarInterval(product.recurringInterval ?? "month"),
          intervalCount: 1,
          metadata: product.metadata as Record<string, unknown> | undefined,
        };
      } catch {
        return null;
      }
    },

    async createCheckout(
      options: CreateCheckoutOptions
    ): Promise<CheckoutResult> {
      const checkout = await client.checkouts.create({
        products: [options.productId],
        successUrl: options.successUrl,
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
        const sub = await client.subscriptions.get({ id: subscriptionId });
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
      // Polar uses update with cancelAtPeriodEnd or revoke for immediate cancellation
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
      const response = await client.subscriptions.list({
        customerId: options.customerId,
        limit: options.limit ?? DEFAULT_LIMIT,
      });

      return response.result.items.map((sub) => ({
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
      }));
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
        const customer = await client.customers.get({ id: customerId });
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
        data?: { subscription?: Subscription; customer?: Customer };
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
