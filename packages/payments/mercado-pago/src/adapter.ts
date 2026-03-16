/**
 * MercadoPago adapter implementing the core PaymentProviderAdapter interface.
 * This bridges @beztack/mercadopago's own client with @beztack/payments.
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

import { createMercadoPagoClient } from "./server/client.js";

function mapMPStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "authorized":
    case "active":
      return "active";
    case "paused":
      return "paused";
    case "cancelled":
    case "canceled":
      return "canceled";
    case "pending":
      return "pending";
    default:
      return "inactive";
  }
}

function mapMPInterval(frequencyType: string): BillingInterval {
  switch (frequencyType) {
    case "months":
      return "month";
    case "days":
      return "day";
    default:
      return "month";
  }
}

/**
 * Convert our interval to MercadoPago's frequency/frequency_type.
 * MP only supports "months" and "days".
 */
function toMPRecurring(
  interval: BillingInterval,
  intervalCount = 1
): { frequency: number; frequency_type: "months" | "days" } {
  return {
    frequency: intervalCount,
    frequency_type: interval === "day" ? "days" : "months",
  };
}

const EXTERNAL_REFERENCE_PREFIX = "beztack_";

type ExternalReferenceMetadata = {
  userId?: string;
  organizationId?: string;
  referenceId?: string;
  tier?: string;
};

function readString(
  source: Record<string, unknown> | undefined,
  key: string
): string | undefined {
  const value = source?.[key];
  return typeof value === "string" ? value : undefined;
}

function encodeExternalReference(options: {
  customerId?: string;
  metadata?: Record<string, unknown>;
}): string | undefined {
  const userId = readString(options.metadata, "userId") ?? options.customerId;
  const organizationId = readString(options.metadata, "organizationId");
  const referenceId = readString(options.metadata, "referenceId");
  const tier = readString(options.metadata, "tier");

  const parts: string[] = [];
  if (userId) {
    parts.push(`uid=${userId}`);
  }
  if (organizationId) {
    parts.push(`org=${organizationId}`);
  }
  if (tier) {
    parts.push(`tier=${tier}`);
  }
  if (referenceId) {
    parts.push(`ref=${referenceId}`);
  }

  if (parts.length === 0) {
    return options.customerId ?? referenceId;
  }

  return `${EXTERNAL_REFERENCE_PREFIX}${parts.join("_")}`;
}

export function decodeExternalReference(
  rawExternalReference?: string
): ExternalReferenceMetadata | undefined {
  if (!rawExternalReference) {
    return;
  }

  if (!rawExternalReference.startsWith(EXTERNAL_REFERENCE_PREFIX)) {
    return {
      userId: rawExternalReference,
      referenceId: rawExternalReference,
    };
  }

  const raw = rawExternalReference.slice(EXTERNAL_REFERENCE_PREFIX.length);
  const params = new URLSearchParams(raw);
  const metadata: ExternalReferenceMetadata = {};

  const userId = params.get("uid");
  if (userId) {
    metadata.userId = userId;
  }

  const organizationId = params.get("org");
  if (organizationId) {
    metadata.organizationId = organizationId;
  }

  const referenceId = params.get("ref");
  if (referenceId) {
    metadata.referenceId = referenceId;
  }

  const tier = params.get("tier");
  if (tier) {
    metadata.tier = tier;
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function buildSubscriptionBody(
  options: CreateSubscriptionOptions,
  successUrl: string,
  currency: string
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    payer_email: options.customerEmail,
    back_url: options.backUrl ?? successUrl,
    status: "pending",
  };

  if (options.productId) {
    body.preapproval_plan_id = options.productId;
  } else if (options.customPlan) {
    body.reason = options.customPlan.reason;
    body.auto_recurring = {
      ...toMPRecurring(
        options.customPlan.interval,
        options.customPlan.intervalCount
      ),
      transaction_amount: options.customPlan.amount,
      currency_id: options.customPlan.currency || currency,
    };
  }

  const externalReference = encodeExternalReference({
    customerId: options.customerId,
    metadata: options.metadata,
  });
  if (externalReference) {
    body.external_reference = externalReference;
  }

  return body;
}

const SUBSCRIPTION_ACTION_MAP: Record<string, WebhookPayload["type"]> = {
  created: "subscription.created",
  updated: "subscription.updated",
  cancelled: "subscription.canceled",
  paused: "subscription.paused",
  authorized: "subscription.active",
};

async function resolveWebhookPayload(
  payload: { type: string; action: string; data: { id: string } },
  getSubscription: (id: string) => Promise<Subscription | null>
): Promise<WebhookPayload> {
  let mappedType: WebhookPayload["type"] = "subscription.updated";
  let subscription: Subscription | undefined;
  let customer: Customer | undefined;

  if (payload.type === "subscription_preapproval") {
    mappedType =
      SUBSCRIPTION_ACTION_MAP[payload.action] ?? "subscription.updated";

    if (payload.data?.id) {
      subscription = (await getSubscription(payload.data.id)) ?? undefined;
      if (subscription?.customerEmail) {
        customer = {
          id: subscription.customerId,
          email: subscription.customerEmail,
          metadata: subscription.metadata,
        };
      }
    }
  } else if (payload.type === "payment") {
    const isFailed =
      payload.action.includes("rejected") || payload.action.includes("failed");
    mappedType = isFailed ? "payment.failed" : "payment.success";
  }

  return {
    type: mappedType,
    provider: "mercadopago",
    subscription,
    customer,
    rawPayload: payload,
  };
}

export type MercadoPagoAdapterConfig = {
  accessToken: string;
  successUrl: string;
  cancelUrl?: string;
  currency?: string;
  webhookSecret?: string;
  integratorId?: string;
};

export function createMercadoPagoAdapter(
  config: MercadoPagoAdapterConfig
): PaymentProviderAdapter {
  const { accessToken, successUrl, currency = "UYU" } = config;
  const client = createMercadoPagoClient({
    accessToken,
    webhookSecret: config.webhookSecret,
    integratorId: config.integratorId,
  });

  return {
    provider: "mercadopago",

    async listProducts(status = "active"): Promise<Product[]> {
      const plans = await client.plans.list({ status });

      return plans.results.map((plan) => ({
        id: plan.id,
        name: plan.reason,
        description: undefined,
        type: "plan" as const,
        price: {
          amount: plan.auto_recurring.transaction_amount,
          currency: plan.auto_recurring.currency_id,
        },
        interval: mapMPInterval(plan.auto_recurring.frequency_type),
        intervalCount: plan.auto_recurring.frequency,
      }));
    },

    async getProduct(productId: string): Promise<Product | null> {
      try {
        const plan = await client.plans.get(productId);

        return {
          id: plan.id,
          name: plan.reason,
          description: undefined,
          type: "plan" as const,
          price: {
            amount: plan.auto_recurring.transaction_amount,
            currency: plan.auto_recurring.currency_id,
          },
          interval: mapMPInterval(plan.auto_recurring.frequency_type),
          intervalCount: plan.auto_recurring.frequency,
        };
      } catch {
        return null;
      }
    },

    async createProduct(options: CreateProductOptions): Promise<Product> {
      const plan = await client.plans.create({
        reason: options.name,
        auto_recurring: {
          ...toMPRecurring(options.interval, options.intervalCount),
          transaction_amount: options.price.amount,
          currency_id: currency,
        },
        back_url: successUrl,
      });

      return {
        id: plan.id,
        name: plan.reason,
        description: options.description,
        type: "plan" as const,
        price: {
          amount: plan.auto_recurring.transaction_amount,
          currency: plan.auto_recurring.currency_id,
        },
        interval: mapMPInterval(plan.auto_recurring.frequency_type),
        intervalCount: plan.auto_recurring.frequency,
        metadata: options.metadata,
      };
    },

    async updateProduct(
      productId: string,
      options: UpdateProductOptions
    ): Promise<Product> {
      if (options.status === "inactive") {
        await client.plans.deactivate(productId);
        const deactivated = await client.plans.get(productId);

        return {
          id: deactivated.id,
          name: deactivated.reason,
          description: undefined,
          type: "plan" as const,
          price: {
            amount: deactivated.auto_recurring.transaction_amount,
            currency: deactivated.auto_recurring.currency_id,
          },
          interval: mapMPInterval(deactivated.auto_recurring.frequency_type),
          intervalCount: deactivated.auto_recurring.frequency,
          metadata: options.metadata,
        };
      }

      const updateBody: Record<string, unknown> = {};

      if (options.name) {
        updateBody.reason = options.name;
      }

      if (options.price?.amount) {
        updateBody.auto_recurring = {
          transaction_amount: options.price.amount,
        };
      }

      const updated = await client.plans.update(productId, updateBody);

      return {
        id: updated.id,
        name: updated.reason,
        description: undefined,
        type: "plan" as const,
        price: {
          amount: updated.auto_recurring.transaction_amount,
          currency: updated.auto_recurring.currency_id,
        },
        interval: mapMPInterval(updated.auto_recurring.frequency_type),
        intervalCount: updated.auto_recurring.frequency,
        metadata: options.metadata,
      };
    },

    async deleteProduct(productId: string): Promise<void> {
      // MercadoPago does not support hard deletion — deactivate instead
      await client.plans.deactivate(productId);
    },

    async createCheckout(
      options: CreateCheckoutOptions
    ): Promise<CheckoutResult> {
      const plan = await client.plans.get(options.productId);

      if (plan.status !== "active") {
        throw new Error(
          `Plan is not active (status: ${plan.status}). Only active plans can be used for checkout.`
        );
      }

      if (!plan.init_point) {
        throw new Error(
          "Plan does not have a checkout URL (init_point is missing)."
        );
      }

      const externalReference = encodeExternalReference({
        customerId: options.customerId,
        metadata: options.metadata,
      });

      const separator = plan.init_point.includes("?") ? "&" : "?";
      const checkoutUrl = externalReference
        ? `${plan.init_point}${separator}external_reference=${encodeURIComponent(externalReference)}`
        : plan.init_point;

      return {
        id: `${plan.id}_${Date.now()}`,
        url: checkoutUrl,
      };
    },

    async createSubscription(
      options: CreateSubscriptionOptions
    ): Promise<Subscription> {
      const body = buildSubscriptionBody(options, successUrl, currency);

      const subscription = await client.subscriptions.create(
        body as Parameters<typeof client.subscriptions.create>[0]
      );
      const metadata = decodeExternalReference(subscription.external_reference);

      return {
        id: subscription.id,
        status: mapMPStatus(subscription.status),
        productId: options.productId ?? "",
        customerId: metadata?.userId ?? String(subscription.payer_id),
        customerEmail: subscription.payer_email,
        currentPeriodEnd: subscription.next_payment_date
          ? new Date(subscription.next_payment_date)
          : undefined,
        metadata: metadata ?? options.metadata,
      };
    },

    async getSubscription(
      subscriptionId: string
    ): Promise<Subscription | null> {
      try {
        const sub = await client.subscriptions.get(subscriptionId);
        const metadata = decodeExternalReference(sub.external_reference);

        return {
          id: sub.id ?? subscriptionId,
          status: mapMPStatus(sub.status ?? "inactive"),
          productId: "",
          productName: sub.reason,
          customerId: metadata?.userId ?? String(sub.payer_id ?? ""),
          customerEmail: sub.payer_email,
          currentPeriodEnd: sub.next_payment_date
            ? new Date(sub.next_payment_date)
            : undefined,
          metadata,
        };
      } catch {
        return null;
      }
    },

    async updateSubscription(
      subscriptionId: string,
      options: UpdateSubscriptionOptions
    ): Promise<Subscription> {
      const body: Record<string, unknown> = {};

      if (options.status === "pause") {
        body.status = "paused";
      } else if (options.status === "resume") {
        body.status = "authorized";
      } else if (options.status === "cancel") {
        body.status = "cancelled";
      }

      const updated = await client.subscriptions.update(
        subscriptionId,
        body as Parameters<typeof client.subscriptions.update>[1]
      );

      return {
        id: updated.id ?? subscriptionId,
        status: mapMPStatus(updated.status ?? "inactive"),
        productId: "",
        productName: updated.reason,
        customerId: String(updated.payer_id ?? ""),
        currentPeriodEnd: updated.next_payment_date
          ? new Date(updated.next_payment_date)
          : undefined,
      };
    },

    async cancelSubscription(
      subscriptionId: string,
      _immediately = false
    ): Promise<Subscription> {
      const canceled = await client.subscriptions.cancel(subscriptionId);

      return {
        id: canceled.id ?? subscriptionId,
        status: "canceled",
        productId: "",
        productName: canceled.reason,
        customerId: String(canceled.payer_id ?? ""),
        currentPeriodEnd: canceled.next_payment_date
          ? new Date(canceled.next_payment_date)
          : undefined,
        cancelAtPeriodEnd: false,
      };
    },

    async listSubscriptions(
      options: ListSubscriptionsOptions
    ): Promise<Subscription[]> {
      const result = await client.subscriptions.search({
        payer_email: options.customerEmail,
        status: options.status,
        limit: options.limit,
        offset: options.offset,
      });

      return result.results.map((sub) => {
        const metadata = decodeExternalReference(sub.external_reference);

        return {
          id: sub.id,
          status: mapMPStatus(sub.status),
          productId: "",
          productName: sub.reason,
          customerId: metadata?.userId ?? String(sub.payer_id),
          customerEmail: sub.payer_email,
          currentPeriodEnd: sub.next_payment_date
            ? new Date(sub.next_payment_date)
            : undefined,
          metadata,
        };
      });
    },

    async createCustomer(
      email: string,
      metadata?: Record<string, unknown>
    ): Promise<Customer> {
      const customer = await client.customers.create({
        email,
      });

      return {
        id: customer.id,
        email: customer.email,
        metadata,
      };
    },

    async getCustomer(customerId: string): Promise<Customer | null> {
      try {
        const customer = await client.customers.get(customerId);
        return {
          id: customer.id,
          email: customer.email,
        };
      } catch {
        return null;
      }
    },

    async getCustomerByEmail(email: string): Promise<Customer | null> {
      try {
        const result = await client.customers.searchByEmail(email);
        const customer = result.results[0];
        if (!customer) {
          return null;
        }
        return {
          id: customer.id,
          email: customer.email,
        };
      } catch {
        return null;
      }
    },

    async parseWebhook(
      rawBody: string,
      _signature: string
    ): Promise<WebhookPayload> {
      const payload = JSON.parse(rawBody) as {
        type: string;
        action: string;
        data: { id: string };
      };

      const result = await resolveWebhookPayload(
        payload,
        this.getSubscription.bind(this)
      );
      return result;
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
  return createMercadoPagoAdapter({
    accessToken: config.MERCADO_PAGO_ACCESS_TOKEN ?? "",
    successUrl: config.PAYMENTS_SUCCESS_URL ?? config.POLAR_SUCCESS_URL ?? "",
    cancelUrl: config.PAYMENTS_CANCEL_URL,
    currency: config.MERCADO_PAGO_CURRENCY ?? "UYU",
    webhookSecret: config.MERCADO_PAGO_WEBHOOK_SECRET,
    integratorId: config.MERCADO_PAGO_INTEGRATOR_ID,
  });
}
