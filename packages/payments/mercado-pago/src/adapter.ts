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
import { SubscriptionUpdateNotAppliedError } from "@beztack/payments";
import { majorToMinor, minorToMajor } from "@beztack/payments/money";
import { decodeExternalReference, encodeExternalReference } from "./helpers/external-reference.js";
import { mapMPStatus } from "./helpers/status-mapping.js";
import { createMercadoPagoClient } from "./server/client.js";
import type { MPPreapproval, MPPreapprovalPlan, MPSubscriptionResponse } from "./types.js";

/**
 * Mercado Pago speaks decimal major units (`9.99`); the domain speaks integer
 * minor units (`999`, ADR 0007). The adapter converts at its edge, once per
 * crossing. An amount read from Mercado Pago is rounded to the nearest minor
 * unit: the provider never reports sub-minor-unit precision for our plans, so
 * rounding only absorbs floating point noise.
 */
function fromProviderAmount(major: number, currency: string): number {
  return majorToMinor(major, currency, { rounding: "half-away-from-zero" });
}

/** Domain minor units to Mercado Pago decimals. Throws on a non-integer amount. */
function toProviderAmount(minor: number, currency: string): number {
  return minorToMajor(minor, currency);
}

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
  intervalCount = 1,
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
  currency: string,
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
    const planCurrency = options.customPlan.currency || currency;
    const autoRecurring: Record<string, unknown> = {
      ...toMPRecurring(options.customPlan.interval, options.customPlan.intervalCount),
      transaction_amount: toProviderAmount(options.customPlan.amount, planCurrency),
      currency_id: planCurrency,
    };
    if (options.customPlan.freeTrial) {
      autoRecurring.free_trial = {
        frequency: options.customPlan.freeTrial.frequency,
        frequency_type: options.customPlan.freeTrial.frequencyType === "days" ? "days" : "months",
      };
    }
    body.auto_recurring = autoRecurring;
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

function resolveWebhookPayload(payload: {
  type: string;
  action: string;
  data: { id: string };
}): WebhookPayload {
  let mappedType: WebhookPayload["type"] = "subscription.updated";

  if (payload.type === "subscription_preapproval") {
    mappedType = SUBSCRIPTION_ACTION_MAP[payload.action] ?? "subscription.updated";
  } else if (payload.type === "payment") {
    const isFailed = payload.action.includes("rejected") || payload.action.includes("failed");
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
  /**
   * The project's default currency (`DEFAULT_CURRENCY`). Used only when a
   * price or plan carries no currency of its own. Required: there is no
   * built-in regional default.
   */
  currency: string;
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

function resolveRequiredApplicationId(applicationId: string | undefined): string {
  const normalized = normalizeApplicationId(applicationId);
  if (!normalized) {
    throw new Error("MERCADO_PAGO_APPLICATION_ID is required when using Mercado Pago");
  }
  return normalized;
}

function resolveRequiredCurrency(currency: string | undefined): string {
  const normalized = currency?.trim();
  if (!normalized) {
    throw new Error("DEFAULT_CURRENCY is required when using Mercado Pago");
  }
  return normalized;
}

function belongsToApplication(
  resource: ApplicationScopedResource,
  expectedApplicationId: string,
): boolean {
  return normalizeApplicationId(resource.application_id) === expectedApplicationId;
}

function assertBelongsToApplication(
  resource: ApplicationScopedResource,
  expectedApplicationId: string,
  resourceType: string,
): void {
  if (belongsToApplication(resource, expectedApplicationId)) {
    return;
  }

  throw new Error(
    `Mercado Pago ${resourceType} does not belong to the configured Mercado Pago Application`,
  );
}

function hasMetadata(metadata: Record<string, unknown>): boolean {
  return Object.keys(metadata).length > 0;
}

function withProviderIntegrationMetadata(
  metadata: Record<string, unknown> | undefined,
  resource: ApplicationScopedResource,
): Record<string, unknown> | undefined {
  const providerIntegrationId = normalizeApplicationId(resource.application_id);
  const merged = {
    ...metadata,
    ...(providerIntegrationId ? { providerIntegrationId } : {}),
  };

  return hasMetadata(merged) ? merged : undefined;
}

function mapPlanToProduct(plan: MPPreapprovalPlan, metadata?: Record<string, unknown>): Product {
  return {
    id: plan.id,
    name: plan.reason,
    description: undefined,
    type: "plan" as const,
    price: {
      amount: fromProviderAmount(
        plan.auto_recurring.transaction_amount,
        plan.auto_recurring.currency_id,
      ),
      currency: plan.auto_recurring.currency_id,
    },
    interval: mapMPInterval(plan.auto_recurring.frequency_type),
    intervalCount: plan.auto_recurring.frequency,
    metadata: withProviderIntegrationMetadata(metadata, plan),
  };
}

/**
 * What the provider charges per period, in minor units. Undefined when the
 * provider reports no amount. `defaultCurrency` only fills a missing currency.
 */
function readBillingAmount(
  autoRecurring: MPSubscriptionResponse["auto_recurring"],
  defaultCurrency: string,
): number | undefined {
  const amount = autoRecurring?.transaction_amount;
  if (typeof amount !== "number") {
    return;
  }
  return fromProviderAmount(amount, autoRecurring?.currency_id || defaultCurrency);
}

function mapSubscriptionResource(
  sub: MPPreapproval | MPSubscriptionResponse,
  defaultCurrency: string,
  fallbackId?: string,
): Subscription {
  const decodedRef = decodeExternalReference(sub.external_reference);

  return {
    id: sub.id ?? fallbackId ?? "",
    status: mapMPStatus(sub.status ?? "inactive"),
    productId: sub.preapproval_plan_id ?? "",
    productName: sub.reason ?? undefined,
    customerId: decodedRef?.userId ?? String(sub.payer_id ?? ""),
    customerEmail: sub.payer_email,
    currentPeriodStart: sub.date_created ? new Date(sub.date_created) : undefined,
    currentPeriodEnd: sub.next_payment_date ? new Date(sub.next_payment_date) : undefined,
    cancelAtPeriodEnd: false,
    metadata: withProviderIntegrationMetadata(
      {
        ...decodedRef,
        billingAmount: readBillingAmount(sub.auto_recurring, defaultCurrency),
        billingCurrency: sub.auto_recurring?.currency_id,
        billingInterval: mapMPInterval(sub.auto_recurring?.frequency_type ?? "months"),
        billingFrequency: sub.auto_recurring?.frequency,
        ...(sub.payment_method_id ? { paymentMethodId: sub.payment_method_id } : {}),
        ...("init_point" in sub ? { initPoint: sub.init_point } : {}),
      },
      sub,
    ),
  };
}

function appendApplicationMatches<T extends ApplicationScopedResource>(options: {
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

function getNextPageOffset<T>(page: SearchPage<T>, currentOffset: number): number {
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

async function scanApplicationPages<T extends ApplicationScopedResource>(options: {
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

function mapSearchResult(
  sub: MPPreapproval,
  defaultCurrency: string,
): {
  subscription: Subscription;
  debug: Record<string, unknown>;
} {
  const decodedRef = decodeExternalReference(sub.external_reference);
  const subscription = mapSubscriptionResource(sub, defaultCurrency);

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

export function createMercadoPagoAdapter(config: MercadoPagoAdapterConfig): PaymentProviderAdapter {
  const { accessToken, successUrl } = config;
  const applicationId = resolveRequiredApplicationId(config.applicationId);
  const currency = resolveRequiredCurrency(config.currency);
  const client = createMercadoPagoClient({
    accessToken,
    webhookSecret: config.webhookSecret,
    integratorId: config.integratorId,
  });

  /**
   * The amount a Subscription must charge to follow `productId`. Refuses a
   * target Mercado Pago cannot apply to an existing preapproval: another
   * frequency or another currency.
   */
  async function resolveTargetAmount(
    subscriptionId: string,
    current: MPSubscriptionResponse,
    productId: string,
  ): Promise<number> {
    const target = await client.plans.get(productId);
    assertBelongsToApplication(target, applicationId, "Plan");

    const from = current.auto_recurring;
    const to = target.auto_recurring;
    if (from?.frequency !== to.frequency || from?.frequency_type !== to.frequency_type) {
      throw new SubscriptionUpdateNotAppliedError(
        subscriptionId,
        "Mercado Pago cannot change the frequency of an existing subscription",
      );
    }
    if (from?.currency_id !== to.currency_id) {
      throw new SubscriptionUpdateNotAppliedError(
        subscriptionId,
        "Mercado Pago cannot change the currency of an existing subscription",
      );
    }

    return to.transaction_amount;
  }

  return {
    provider: "mercadopago",
    // A preapproval's frequency cannot be changed (verified in the sandbox, #48).
    capabilities: { cadenceChange: false, proratedUpgrade: false },

    async listProducts(status = "active"): Promise<Product[]> {
      const plans = await scanApplicationPages({
        expectedApplicationId: applicationId,
        pageLimit: PROVIDER_PAGE_LIMIT,
        initialOffset: 0,
        fetchPage: ({ limit, offset }) => client.plans.list({ status, limit, offset }),
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
          transaction_amount: toProviderAmount(
            options.price.amount,
            options.price.currency || currency,
          ),
          // The price's own currency wins; the project default only fills a gap.
          currency_id: options.price.currency || currency,
        },
        back_url: successUrl,
      });

      assertBelongsToApplication(plan, applicationId, "Product");

      return mapPlanToProduct(plan, options.metadata);
    },

    async updateProduct(productId: string, options: UpdateProductOptions): Promise<Product> {
      const current = await client.plans.get(productId);
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
          transaction_amount: toProviderAmount(
            options.price.amount,
            options.price.currency || currency,
          ),
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

    async createCheckout(options: CreateCheckoutOptions): Promise<CheckoutResult> {
      const plan = await client.plans.get(options.productId);
      if (!belongsToApplication(plan, applicationId)) {
        throw new Error("Product not found");
      }

      if (plan.status !== "active") {
        throw new Error(
          `Plan is not active (status: ${plan.status}). Only active plans can be used for checkout.`,
        );
      }

      if (!options.customerEmail) {
        throw new Error("Customer email is required to create Mercado Pago subscription checkout");
      }

      const body = buildSubscriptionBody(
        {
          customerEmail: options.customerEmail,
          customerId: options.customerId,
          metadata: {
            ...options.metadata,
            targetPlanId: options.productId,
          },
          backUrl: options.successUrl,
          customPlan: {
            reason: plan.reason,
            // Minor units in, decimals back out when the body is built: the
            // plan's own amount survives the round trip unchanged.
            amount: fromProviderAmount(
              plan.auto_recurring.transaction_amount,
              plan.auto_recurring.currency_id,
            ),
            currency: plan.auto_recurring.currency_id,
            interval: mapMPInterval(plan.auto_recurring.frequency_type),
            intervalCount: plan.auto_recurring.frequency,
          },
        },
        successUrl,
        currency,
      );
      const subscription = await client.subscriptions.create(
        body as Parameters<typeof client.subscriptions.create>[0],
      );
      assertBelongsToApplication(subscription, applicationId, "Subscription");

      if (!(subscription.id && subscription.init_point)) {
        throw new Error("Mercado Pago did not return a checkout URL for the subscription");
      }

      return {
        id: subscription.id,
        url: subscription.init_point,
      };
    },

    async createSubscription(options: CreateSubscriptionOptions): Promise<Subscription> {
      if (options.productId) {
        const plan = await client.plans.get(options.productId);
        if (!belongsToApplication(plan, applicationId)) {
          throw new Error("Product not found");
        }
      }

      const body = buildSubscriptionBody(options, successUrl, currency);

      const subscription = await client.subscriptions.create(
        body as Parameters<typeof client.subscriptions.create>[0],
      );
      assertBelongsToApplication(subscription, applicationId, "Subscription");

      const result = mapSubscriptionResource(subscription, currency);
      result.productId = options.productId ?? result.productId;
      result.metadata = withProviderIntegrationMetadata(
        {
          ...options.metadata,
          ...result.metadata,
          initPoint: subscription.init_point,
        },
        subscription,
      );

      return result;
    },

    async getSubscription(subscriptionId: string): Promise<Subscription | null> {
      try {
        const sub = await client.subscriptions.get(subscriptionId);
        if (!belongsToApplication(sub, applicationId)) {
          return null;
        }

        return mapSubscriptionResource(sub, currency, subscriptionId);
      } catch {
        return null;
      }
    },

    async updateSubscription(
      subscriptionId: string,
      options: UpdateSubscriptionOptions,
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

      // Mercado Pago cannot move a preapproval to another plan or frequency
      // (it answers 200 and ignores both). It can change the amount, so a
      // Product move becomes "charge the target plan's amount from the next
      // charge", and the amount that comes back is verified.
      let targetAmount: number | undefined;
      if (options.productId) {
        targetAmount = await resolveTargetAmount(subscriptionId, current, options.productId);
        body.auto_recurring = { transaction_amount: targetAmount };
      }

      await client.subscriptions.update(
        subscriptionId,
        body as Parameters<typeof client.subscriptions.update>[1],
      );
      const updated = await client.subscriptions.get(subscriptionId);
      assertBelongsToApplication(updated, applicationId, "Subscription");

      if (
        targetAmount !== undefined &&
        updated.auto_recurring?.transaction_amount !== targetAmount
      ) {
        throw new SubscriptionUpdateNotAppliedError(
          subscriptionId,
          `Mercado Pago kept charging ${updated.auto_recurring?.transaction_amount} instead of ${targetAmount}`,
        );
      }

      return mapSubscriptionResource(updated, currency, subscriptionId);
    },

    async cancelSubscription(subscriptionId: string, _immediately = false): Promise<Subscription> {
      const current = await client.subscriptions.get(subscriptionId);
      if (!belongsToApplication(current, applicationId)) {
        throw new Error("Subscription not found");
      }

      await client.subscriptions.cancel(subscriptionId);
      const canceled = await client.subscriptions.get(subscriptionId);
      assertBelongsToApplication(canceled, applicationId, "Subscription");

      return {
        ...mapSubscriptionResource(canceled, currency, subscriptionId),
        status: "canceled",
      };
    },

    async listSubscriptions(options: ListSubscriptionsOptions): Promise<Subscription[]> {
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
      const mappedResults = matchingResults.map((item) => mapSearchResult(item, currency));
      const subscriptions = mappedResults.map(({ subscription }) => subscription);

      return subscriptions;
    },

    async createCustomer(email: string, metadata?: Record<string, unknown>): Promise<Customer> {
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
export function createAdapter(config: Record<string, string>): PaymentProviderAdapter {
  return createMercadoPagoAdapter({
    accessToken: config.MERCADO_PAGO_ACCESS_TOKEN ?? "",
    applicationId: config.MERCADO_PAGO_APPLICATION_ID ?? "",
    successUrl: config.PAYMENTS_SUCCESS_URL ?? config.POLAR_SUCCESS_URL ?? "",
    cancelUrl: config.PAYMENTS_CANCEL_URL,
    currency: config.DEFAULT_CURRENCY ?? "",
    webhookSecret: config.MERCADO_PAGO_WEBHOOK_SECRET,
    integratorId: config.MERCADO_PAGO_INTEGRATOR_ID,
  });
}
