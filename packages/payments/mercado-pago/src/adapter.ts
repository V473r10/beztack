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
  UpdateProductOptions,
  UpdateSubscriptionOptions,
  WebhookPayload,
} from "@beztack/payments";
import {
  decodeExternalReference,
  encodeExternalReference,
} from "./helpers/external-reference.js";
import { mapMPStatus } from "./helpers/status-mapping.js";
import { createMercadoPagoClient } from "./server/client.js";
import type {
  MPPreapproval,
  MPPreapprovalPlan,
  MPSubscriptionResponse,
} from "./types.js";

const PROVIDER_PAGE_LIMIT = 50;
const MAX_APPLICATION_SCAN_PAGES = 50;

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
  // console.log("[MercadoPagoAdapter] buildSubscriptionBody", {
  //   options,
  //   successUrl,
  //   currency,
  // });

  const body: Record<string, unknown> = {
    payer_email: options.customerEmail,
    back_url: options.backUrl ?? successUrl,
    status: "pending",
  };

  if (options.productId) {
    body.preapproval_plan_id = options.productId;
  } else if (options.customPlan) {
    body.reason = options.customPlan.reason;
    const autoRecurring: Record<string, unknown> = {
      ...toMPRecurring(
        options.customPlan.interval,
        options.customPlan.intervalCount
      ),
      transaction_amount: options.customPlan.amount,
      currency_id: options.customPlan.currency || currency,
    };
    if (options.customPlan.freeTrial) {
      autoRecurring.free_trial = {
        frequency: options.customPlan.freeTrial.frequency,
        frequency_type:
          options.customPlan.freeTrial.frequencyType === "days"
            ? "days"
            : "months",
      };
    }
    body.auto_recurring = autoRecurring;
  }

  const externalReference = encodeExternalReference({
    customerId: options.customerId,
    metadata: options.metadata,
  });

  // console.log("[MercadoPagoAdapter] buildSubscriptionBody: externalReference", {
  //   externalReference,
  // });

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

function resolveWebhookPayload(payload: {
  type: string;
  action: string;
  data: { id: string };
}): WebhookPayload {
  let mappedType: WebhookPayload["type"] = "subscription.updated";

  if (payload.type === "subscription_preapproval") {
    mappedType =
      SUBSCRIPTION_ACTION_MAP[payload.action] ?? "subscription.updated";
  } else if (payload.type === "payment") {
    const isFailed =
      payload.action.includes("rejected") || payload.action.includes("failed");
    mappedType = isFailed ? "payment.failed" : "payment.success";
  }

  return {
    type: mappedType,
    provider: "mercadopago",
    rawPayload: payload,
  };
}

export type MercadoPagoAdapterConfig = {
  accessToken: string;
  applicationId?: string;
  successUrl: string;
  cancelUrl?: string;
  currency?: string;
  webhookSecret?: string;
  integratorId?: string;
};

type ApplicationScopedResource = {
  id?: string | number;
  application_id?: string | number | null;
};

type SearchPage<T> = {
  results: T[];
  paging?: {
    total?: number;
    limit?: number;
    offset?: number;
  };
};

function normalizeApplicationId(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  return null;
}

function resolveRequiredApplicationId(
  applicationId: string | undefined
): string {
  const normalized = normalizeApplicationId(applicationId);
  if (!normalized) {
    throw new Error(
      "MERCADO_PAGO_APPLICATION_ID is required when using Mercado Pago"
    );
  }
  return normalized;
}

function belongsToApplication(
  resource: ApplicationScopedResource,
  expectedApplicationId: string
): boolean {
  return (
    normalizeApplicationId(resource.application_id) === expectedApplicationId
  );
}

function assertBelongsToApplication(
  resource: ApplicationScopedResource,
  expectedApplicationId: string,
  resourceType: string
): void {
  console.log("Resource: ", resource)
  console.log("ExpectedApplicationId: ", expectedApplicationId)
  if (belongsToApplication(resource, expectedApplicationId)) {
    return;
  }

  throw new Error(
    `Mercado Pago ${resourceType} does not belong to the configured Mercado Pago Application`
  );
}

function hasMetadata(metadata: Record<string, unknown>): boolean {
  return Object.keys(metadata).length > 0;
}

function withProviderIntegrationMetadata(
  metadata: Record<string, unknown> | undefined,
  resource: ApplicationScopedResource
): Record<string, unknown> | undefined {
  const providerIntegrationId = normalizeApplicationId(resource.application_id);
  const merged = {
    ...(metadata ?? {}),
    ...(providerIntegrationId ? { providerIntegrationId } : {}),
  };

  return hasMetadata(merged) ? merged : undefined;
}

function mapPlanToProduct(
  plan: MPPreapprovalPlan,
  metadata?: Record<string, unknown>
): Product {
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
    metadata: withProviderIntegrationMetadata(metadata, plan),
  };
}

function mapSubscriptionResource(
  sub: MPPreapproval | MPSubscriptionResponse,
  fallbackId?: string
): Subscription {
  const decodedRef = decodeExternalReference(sub.external_reference);

  return {
    id: sub.id ?? fallbackId ?? "",
    status: mapMPStatus(sub.status ?? "inactive"),
    productId: sub.preapproval_plan_id ?? "",
    productName: sub.reason ?? undefined,
    customerId: decodedRef?.userId ?? String(sub.payer_id ?? ""),
    customerEmail: sub.payer_email,
    currentPeriodStart: sub.date_created
      ? new Date(sub.date_created)
      : undefined,
    currentPeriodEnd: sub.next_payment_date
      ? new Date(sub.next_payment_date)
      : undefined,
    cancelAtPeriodEnd: false,
    metadata: withProviderIntegrationMetadata(
      {
        ...decodedRef,
        billingAmount: sub.auto_recurring?.transaction_amount,
        billingCurrency: sub.auto_recurring?.currency_id,
        billingInterval: mapMPInterval(
          sub.auto_recurring?.frequency_type ?? "months"
        ),
        billingFrequency: sub.auto_recurring?.frequency,
        ...("init_point" in sub ? { initPoint: sub.init_point } : {}),
      },
      sub
    ),
  };
}

function appendApplicationMatches<
  T extends ApplicationScopedResource,
>(options: {
  items: T[];
  expectedApplicationId: string;
  matches: T[];
  maxMatches?: number;
}): boolean {
  for (const item of options.items) {
    if (!belongsToApplication(item, options.expectedApplicationId)) {
      continue;
    }

    options.matches.push(item);
    if (options.maxMatches && options.matches.length >= options.maxMatches) {
      return true;
    }
  }

  return false;
}

function getNextPageOffset<T>(
  page: SearchPage<T>,
  currentOffset: number
): number {
  return (page.paging?.offset ?? currentOffset) + page.results.length;
}

function isApplicationScanExhausted<T>(options: {
  page: SearchPage<T>;
  currentOffset: number;
  requestedPageLimit: number;
}): boolean {
  if (options.page.results.length === 0) {
    return true;
  }

  const nextOffset = getNextPageOffset(options.page, options.currentOffset);
  const total = options.page.paging?.total;
  if (total !== undefined) {
    return nextOffset >= total;
  }

  const pageLimit = options.page.paging?.limit ?? options.requestedPageLimit;
  return options.page.results.length < pageLimit;
}

async function scanApplicationPages<
  T extends ApplicationScopedResource,
>(options: {
  expectedApplicationId: string;
  pageLimit: number;
  initialOffset: number;
  maxMatches?: number;
  fetchPage(input: { limit: number; offset: number }): Promise<SearchPage<T>>;
}): Promise<T[]> {
  const matches: T[] = [];
  let offset = options.initialOffset;

  for (let pageCount = 0; pageCount < MAX_APPLICATION_SCAN_PAGES; pageCount++) {
    const page = await options.fetchPage({
      limit: options.pageLimit,
      offset,
    });

    if (
      appendApplicationMatches({
        items: page.results,
        expectedApplicationId: options.expectedApplicationId,
        matches,
        maxMatches: options.maxMatches,
      })
    ) {
      return matches;
    }

    if (
      isApplicationScanExhausted({
        page,
        currentOffset: offset,
        requestedPageLimit: options.pageLimit,
      })
    ) {
      break;
    }

    offset = getNextPageOffset(page, offset);
  }

  return matches;
}

function mapSearchResult(sub: MPPreapproval): {
  subscription: Subscription;
  debug: Record<string, unknown>;
} {
  const decodedRef = decodeExternalReference(sub.external_reference);
  const subscription = mapSubscriptionResource(sub);

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
      applicationId: normalizeApplicationId(sub.application_id),
    },
  };
}

export function createMercadoPagoAdapter(
  config: MercadoPagoAdapterConfig
): PaymentProviderAdapter {
  const { accessToken, successUrl, currency = "UYU" } = config;
  const applicationId = resolveRequiredApplicationId(config.applicationId);
  const client = createMercadoPagoClient({
    accessToken,
    webhookSecret: config.webhookSecret,
    integratorId: config.integratorId,
  });

  return {
    provider: "mercadopago",

    async listProducts(status = "active"): Promise<Product[]> {
      const plans = await scanApplicationPages({
        expectedApplicationId: applicationId,
        pageLimit: PROVIDER_PAGE_LIMIT,
        initialOffset: 0,
        fetchPage: ({ limit, offset }) =>
          client.plans.list({ status, limit, offset }),
      });

      return plans.map((plan) => mapPlanToProduct(plan));
    },

    async getProduct(productId: string): Promise<Product | null> {
      try {
        const plan = await client.plans.get(productId);
        if (!belongsToApplication(plan, applicationId)) {
          return null;
        }

        return mapPlanToProduct(plan);
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

      assertBelongsToApplication(plan, applicationId, "Product");

      return mapPlanToProduct(plan, options.metadata);
    },

    async updateProduct(
      productId: string,
      options: UpdateProductOptions
    ): Promise<Product> {
      const current = await client.plans.get(productId);
      console.log("Current: ", current)
      console.log("ApplicationId: ", applicationId)
      if (!belongsToApplication(current, applicationId)) {
        throw new Error("Product not found");
      }

      if (options.status === "inactive") {
        await client.plans.deactivate(productId);
        const deactivated = await client.plans.get(productId);
        assertBelongsToApplication(deactivated, applicationId, "Product");

        return mapPlanToProduct(deactivated, options.metadata);
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
      assertBelongsToApplication(updated, applicationId, "Product");

      return mapPlanToProduct(updated, options.metadata);
    },

    async deleteProduct(productId: string): Promise<void> {
      // MercadoPago does not support hard deletion — deactivate instead
      const current = await client.plans.get(productId);
      if (!belongsToApplication(current, applicationId)) {
        throw new Error("Product not found");
      }
      const deactivated = await client.plans.deactivate(productId);
      assertBelongsToApplication(deactivated, applicationId, "Product");
    },

    async createCheckout(
      options: CreateCheckoutOptions
    ): Promise<CheckoutResult> {
      // console.log("[MercadoPagoAdapter] createCheckout", {
      //   options,
      // });
      const plan = await client.plans.get(options.productId);
      if (!belongsToApplication(plan, applicationId)) {
        throw new Error("Product not found");
      }

      if (plan.status !== "active") {
        throw new Error(
          `Plan is not active (status: ${plan.status}). Only active plans can be used for checkout.`
        );
      }

      // console.log("[MercadoPagoAdapter] createCheckout: plan", {
      //   plan,
      // });

      if (!plan.init_point) {
        throw new Error(
          "Plan does not have a checkout URL (init_point is missing)."
        );
      }

      const externalReference = encodeExternalReference({
        customerId: options.customerId,
        metadata: options.metadata,
      });

      // console.log("[MercadoPagoAdapter] createCheckout: externalReference", {
      //   externalReference,
      // });

      const separator = plan.init_point.includes("?") ? "&" : "?";
      const checkoutUrl = externalReference
        ? `${plan.init_point}${separator}external_reference=${encodeURIComponent(externalReference)}`
        : plan.init_point;

      // console.log("[MercadoPagoAdapter] createCheckout: checkoutUrl", {
      //   checkoutUrl,
      // });

      return {
        id: `${plan.id}_${Date.now()}`,
        url: checkoutUrl,
      };
    },

    async createSubscription(
      options: CreateSubscriptionOptions
    ): Promise<Subscription> {
      if (options.productId) {
        const plan = await client.plans.get(options.productId);
        if (!belongsToApplication(plan, applicationId)) {
          throw new Error("Product not found");
        }
      }

      const body = buildSubscriptionBody(options, successUrl, currency);

      const subscription = await client.subscriptions.create(
        body as Parameters<typeof client.subscriptions.create>[0]
      );
      assertBelongsToApplication(subscription, applicationId, "Subscription");

      const result = mapSubscriptionResource(subscription);
      result.productId = options.productId ?? result.productId;
      result.metadata = withProviderIntegrationMetadata(
        {
          ...(options.metadata ?? {}),
          ...(result.metadata ?? {}),
          initPoint: subscription.init_point,
        },
        subscription
      );

      return result;
    },

    async getSubscription(
      subscriptionId: string
    ): Promise<Subscription | null> {
      try {
        const sub = await client.subscriptions.get(subscriptionId);
        if (!belongsToApplication(sub, applicationId)) {
          return null;
        }

        return mapSubscriptionResource(sub, subscriptionId);
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

      const current = await client.subscriptions.get(subscriptionId);
      if (!belongsToApplication(current, applicationId)) {
        throw new Error("Subscription not found");
      }

      await client.subscriptions.update(
        subscriptionId,
        body as Parameters<typeof client.subscriptions.update>[1]
      );
      const updated = await client.subscriptions.get(subscriptionId);
      assertBelongsToApplication(updated, applicationId, "Subscription");

      return mapSubscriptionResource(updated, subscriptionId);
    },

    async cancelSubscription(
      subscriptionId: string,
      _immediately = false
    ): Promise<Subscription> {
      const current = await client.subscriptions.get(subscriptionId);
      if (!belongsToApplication(current, applicationId)) {
        throw new Error("Subscription not found");
      }

      await client.subscriptions.cancel(subscriptionId);
      const canceled = await client.subscriptions.get(subscriptionId);
      assertBelongsToApplication(canceled, applicationId, "Subscription");

      return {
        ...mapSubscriptionResource(canceled, subscriptionId),
        status: "canceled",
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

      const pageLimit = options.limit ?? PROVIDER_PAGE_LIMIT;
      const matchingResults = await scanApplicationPages({
        expectedApplicationId: applicationId,
        pageLimit,
        initialOffset: options.offset ?? 0,
        maxMatches: options.limit,
        fetchPage: ({ limit, offset }) =>
          client.subscriptions.search({
            ...searchParams,
            limit,
            offset,
          }),
      });
      const mappedResults = matchingResults.map(mapSearchResult);
      const subscriptions = mappedResults.map(
        ({ subscription }) => subscription
      );

      return subscriptions;
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

    parseWebhook(rawBody: string, _signature: string): Promise<WebhookPayload> {
      const payload = JSON.parse(rawBody) as {
        type: string;
        action: string;
        data: { id: string };
      };

      return Promise.resolve(resolveWebhookPayload(payload));
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
    applicationId: config.MERCADO_PAGO_APPLICATION_ID ?? "",
    successUrl: config.PAYMENTS_SUCCESS_URL ?? config.POLAR_SUCCESS_URL ?? "",
    cancelUrl: config.PAYMENTS_CANCEL_URL,
    currency: config.MERCADO_PAGO_CURRENCY ?? "UYU",
    webhookSecret: config.MERCADO_PAGO_WEBHOOK_SECRET,
    integratorId: config.MERCADO_PAGO_INTEGRATOR_ID,
  });
}
