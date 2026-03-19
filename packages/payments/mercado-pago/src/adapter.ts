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
import {
  decodeExternalReference,
  encodeExternalReference,
} from "./helpers/external-reference.js";
import { createMercadoPagoClient } from "./server/client.js";
import type { MPPreapproval } from "./types.js";

function mapMPStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "authorized":
      return "active";
    case "paused":
      return "paused";
    case "cancelled":
      return "canceled";
    default:
      return "canceled";
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

function buildSubscriptionBody(
  options: CreateSubscriptionOptions,
  successUrl: string,
  currency: string
): Record<string, unknown> {
  console.log("[MercadoPagoAdapter] buildSubscriptionBody", {
    options,
    successUrl,
    currency,
  });

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

  console.log("[MercadoPagoAdapter] buildSubscriptionBody: externalReference", {
    externalReference,
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

function getListSubscriptionsDebugContext(
  options: ListSubscriptionsOptions
): Record<string, string | number | null> {
  return {
    customerId: options.customerId ?? null,
    customerEmail: maskEmail(options.customerEmail) ?? null,
    requestedStatus: options.status ?? null,
    limit: options.limit ?? null,
    offset: options.offset ?? null,
  };
}

function logListSubscriptionsStart(
  options: ListSubscriptionsOptions,
  searchParams: {
    payer_email?: string;
    status?: SubscriptionStatus;
    limit?: number;
    offset?: number;
  }
): void {
  // biome-ignore lint/suspicious/noConsole: Debugging Mercado Pago subscription search inputs
  console.log("[MercadoPagoAdapter] listSubscriptions:start", {
    ...getListSubscriptionsDebugContext(options),
    searchParams: {
      payer_email: maskEmail(searchParams.payer_email) ?? null,
      status: searchParams.status ?? null,
      limit: searchParams.limit ?? null,
      offset: searchParams.offset ?? null,
    },
  });
}

function logIgnoredCustomerId(customerId: string): void {
  // biome-ignore lint/suspicious/noConsole: Debugging unsupported customerId filter in Mercado Pago subscription search
  console.log("[MercadoPagoAdapter] listSubscriptions:ignored-filter", {
    filter: "customerId",
    customerId,
    reason:
      "Mercado Pago search only supports payer_email, status, limit and offset",
  });
}

function mapSearchResult(sub: MPPreapproval): {
  subscription: Subscription;
  debug: Record<string, unknown>;
} {
  const decodedRef = decodeExternalReference(sub.external_reference);
  const metadata = {
    ...decodedRef,
    billingAmount: sub.auto_recurring?.transaction_amount,
    billingCurrency: sub.auto_recurring?.currency_id,
    billingInterval: mapMPInterval(
      sub.auto_recurring?.frequency_type ?? "months"
    ),
    billingFrequency: sub.auto_recurring?.frequency,
  };
  const subscription = {
    id: sub.id,
    status: mapMPStatus(sub.status),
    productId: sub.preapproval_plan_id ?? "",
    productName: sub.reason,
    customerId: decodedRef?.userId ?? String(sub.payer_id),
    customerEmail: sub.payer_email,
    currentPeriodStart: sub.date_created
      ? new Date(sub.date_created)
      : undefined,
    currentPeriodEnd: sub.next_payment_date
      ? new Date(sub.next_payment_date)
      : undefined,
    cancelAtPeriodEnd: false,
    metadata,
  } satisfies Subscription;

  return {
    subscription,
    debug: {
      id: sub.id,
      rawStatus: sub.status,
      mappedStatus: subscription.status,
      payerId: sub.payer_id,
      payerEmail: maskEmail(sub.payer_email) ?? null,
      preapprovalPlanId: sub.preapproval_plan_id ?? null,
      nextPaymentDate: sub.next_payment_date ?? null,
      externalReference: sub.external_reference ?? null,
      metadata: decodedRef,
    },
  };
}

function logListSubscriptionsSuccess(
  options: ListSubscriptionsOptions,
  total: number,
  mappedResults: ReturnType<typeof mapSearchResult>[]
): void {
  // biome-ignore lint/suspicious/noConsole: Debugging Mercado Pago subscription search results
  console.log("[MercadoPagoAdapter] listSubscriptions:success", {
    ...getListSubscriptionsDebugContext(options),
    total,
    count: mappedResults.length,
    subscriptions: mappedResults.map(({ debug }) => debug),
  });
}

function logListSubscriptionsError(
  options: ListSubscriptionsOptions,
  error: unknown
): void {
  // biome-ignore lint/suspicious/noConsole: Debugging Mercado Pago subscription search failures
  console.log("[MercadoPagoAdapter] listSubscriptions:error", {
    ...getListSubscriptionsDebugContext(options),
    error:
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
          }
        : error,
  });
}

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
      console.log("[MercadoPagoAdapter] createCheckout", {
        options,
      });
      const plan = await client.plans.get(options.productId);

      if (plan.status !== "active") {
        throw new Error(
          `Plan is not active (status: ${plan.status}). Only active plans can be used for checkout.`
        );
      }

      console.log("[MercadoPagoAdapter] createCheckout: plan", {
        plan,
      });

      if (!plan.init_point) {
        throw new Error(
          "Plan does not have a checkout URL (init_point is missing)."
        );
      }

      const externalReference = encodeExternalReference({
        customerId: options.customerId,
        metadata: options.metadata,
      });

      console.log("[MercadoPagoAdapter] createCheckout: externalReference", {
        externalReference,
      });

      const separator = plan.init_point.includes("?") ? "&" : "?";
      const checkoutUrl = externalReference
        ? `${plan.init_point}${separator}external_reference=${encodeURIComponent(externalReference)}`
        : plan.init_point;

      console.log("[MercadoPagoAdapter] createCheckout: checkoutUrl", {
        checkoutUrl,
      });

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
        productName: subscription.reason,
        customerId: metadata?.userId ?? String(subscription.payer_id),
        customerEmail: subscription.payer_email,
        currentPeriodStart: subscription.date_created
          ? new Date(subscription.date_created)
          : undefined,
        currentPeriodEnd: subscription.next_payment_date
          ? new Date(subscription.next_payment_date)
          : undefined,
        cancelAtPeriodEnd: false,
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
          productId: sub.preapproval_plan_id ?? "",
          productName: sub.reason,
          customerId: metadata?.userId ?? String(sub.payer_id ?? ""),
          customerEmail: sub.payer_email,
          currentPeriodStart: sub.date_created
            ? new Date(sub.date_created)
            : undefined,
          currentPeriodEnd: sub.next_payment_date
            ? new Date(sub.next_payment_date)
            : undefined,
          cancelAtPeriodEnd: false,
          metadata: {
            ...metadata,
            billingAmount: sub.auto_recurring?.transaction_amount,
            billingCurrency: sub.auto_recurring?.currency_id,
            billingInterval: mapMPInterval(
              sub.auto_recurring?.frequency_type ?? "months"
            ),
            billingFrequency: sub.auto_recurring?.frequency,
          },
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
      const updatedMetadata = decodeExternalReference(
        updated.external_reference
      );

      return {
        id: updated.id ?? subscriptionId,
        status: mapMPStatus(updated.status ?? "inactive"),
        productId: updated.preapproval_plan_id ?? "",
        productName: updated.reason,
        customerId: updatedMetadata?.userId ?? String(updated.payer_id ?? ""),
        customerEmail: updated.payer_email,
        currentPeriodEnd: updated.next_payment_date
          ? new Date(updated.next_payment_date)
          : undefined,
        metadata: updatedMetadata,
      };
    },

    async cancelSubscription(
      subscriptionId: string,
      _immediately = false
    ): Promise<Subscription> {
      const canceled = await client.subscriptions.cancel(subscriptionId);
      const canceledMetadata = decodeExternalReference(
        canceled.external_reference
      );

      return {
        id: canceled.id ?? subscriptionId,
        status: "cancelled",
        productId: canceled.preapproval_plan_id ?? "",
        productName: canceled.reason,
        customerId: canceledMetadata?.userId ?? String(canceled.payer_id ?? ""),
        customerEmail: canceled.payer_email,
        currentPeriodEnd: canceled.next_payment_date
          ? new Date(canceled.next_payment_date)
          : undefined,
        cancelAtPeriodEnd: false,
        metadata: canceledMetadata,
      };
    },

    async listSubscriptions(
      options: ListSubscriptionsOptions
    ): Promise<Subscription[]> {
      const searchParams = {
        payer_email: options.customerEmail,
        status: options.status ? options.status : "authorized",
        limit: options.limit,
        offset: options.offset,
      };

      // logListSubscriptionsStart(options, searchParams);

      if (options.customerId) {
        // logIgnoredCustomerId(options.customerId);
      }

      try {
        const result = await client.subscriptions.search(searchParams);
        const mappedResults = result.results.map(mapSearchResult);
        const subscriptions = mappedResults.map(
          ({ subscription }) => subscription
        );

        logListSubscriptionsSuccess(
          options,
          result.paging.total,
          mappedResults
        );

        return subscriptions;
      } catch (error) {
        // logListSubscriptionsError(options, error);
        throw error;
      }
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
