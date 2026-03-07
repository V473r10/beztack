/**
 * Mercado Pago Payment Provider Adapter
 */
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

const MP_API_BASE = "https://api.mercadopago.com";

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

type MPPreapproval = {
  id: string;
  status: string;
  reason: string;
  payer_id: number;
  payer_email?: string;
  init_point: string;
  date_created: string;
  auto_recurring: {
    frequency: number;
    frequency_type: string;
    transaction_amount: number;
    currency_id: string;
  };
  external_reference?: string;
  next_payment_date?: string;
  end_date?: string;
};

type MPPreapprovalPlan = {
  id: string;
  status: string;
  reason: string;
  auto_recurring: {
    frequency: number;
    frequency_type: string;
    transaction_amount: number;
    currency_id: string;
  };
  date_created: string;
  init_point: string;
};

type MPSearchResult = {
  results: MPPreapproval[];
  paging: {
    total: number;
    limit: number;
    offset: number;
  };
};

const EXTERNAL_REFERENCE_PREFIX = "beztack:";

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
  const userId =
    readString(options.metadata, "userId") ?? options.customerId;
  const organizationId = readString(options.metadata, "organizationId");
  const referenceId = readString(options.metadata, "referenceId");
  const tier = readString(options.metadata, "tier");

  const params = new URLSearchParams();
  if (userId) {
    params.set("uid", userId);
  }
  if (organizationId) {
    params.set("org", organizationId);
  }
  if (referenceId) {
    params.set("ref", referenceId);
  }
  if (tier) {
    params.set("tier", tier);
  }

  const encoded = params.toString();
  if (encoded) {
    return `${EXTERNAL_REFERENCE_PREFIX}${encoded}`;
  }

  return options.customerId ?? referenceId;
}

function decodeExternalReference(
  rawExternalReference?: string
): ExternalReferenceMetadata | undefined {
  if (!rawExternalReference) {
    return undefined;
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

async function mpFetch<T>(
  accessToken: string,
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${MP_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      (error as { message?: string }).message ||
        `Mercado Pago API error: ${response.status}`
    );
  }

  return response.json() as Promise<T>;
}

export function createMercadoPagoAdapter(config: {
  accessToken: string;
  successUrl: string;
  cancelUrl?: string;
  currency?: string;
}): PaymentProviderAdapter {
  const { accessToken, successUrl, currency = "UYU" } = config;

  return {
    provider: "mercadopago",

    async listProducts(): Promise<Product[]> {
      const plans = await mpFetch<{ results: MPPreapprovalPlan[] }>(
        accessToken,
        "/preapproval_plan/search"
      );

      return plans.results.map((plan) => ({
        id: plan.id,
        name: plan.reason,
        description: plan.reason,
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
        const plan = await mpFetch<MPPreapprovalPlan>(
          accessToken,
          `/preapproval_plan/${productId}`
        );

        return {
          id: plan.id,
          name: plan.reason,
          description: plan.reason,
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

    async createCheckout(
      options: CreateCheckoutOptions
    ): Promise<CheckoutResult> {
      const plan = await mpFetch<MPPreapprovalPlan>(
        accessToken,
        `/preapproval_plan/${options.productId}`
      );

      const externalReference = encodeExternalReference({
        customerId: options.customerId,
        metadata: options.metadata,
      });

      const subscription = await mpFetch<MPPreapproval>(
        accessToken,
        "/preapproval",
        {
          method: "POST",
          body: JSON.stringify({
            preapproval_plan_id: options.productId,
            payer_email: options.customerEmail,
            back_url: options.successUrl,
            external_reference: externalReference,
            status: "pending",
          }),
        }
      );

      return {
        id: subscription.id,
        url: subscription.init_point || plan.init_point,
      };
    },

    async createSubscription(
      options: CreateSubscriptionOptions
    ): Promise<Subscription> {
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
          frequency: options.customPlan.intervalCount,
          frequency_type:
            options.customPlan.interval === "month" ? "months" : "days",
          transaction_amount: options.customPlan.amount,
          currency_id: options.customPlan.currency || currency,
        };
      }

      // Use customerId (Beztack userId) as external_reference, fallback to metadata
      const externalReference = encodeExternalReference({
        customerId: options.customerId,
        metadata: options.metadata,
      });
      if (externalReference) {
        body.external_reference = externalReference;
      }

      const subscription = await mpFetch<MPPreapproval>(
        accessToken,
        "/preapproval",
        {
          method: "POST",
          body: JSON.stringify(body),
        }
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
        const sub = await mpFetch<MPPreapproval>(
          accessToken,
          `/preapproval/${subscriptionId}`
        );
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

      const updated = await mpFetch<MPPreapproval>(
        accessToken,
        `/preapproval/${subscriptionId}`,
        {
          method: "PUT",
          body: JSON.stringify(body),
        }
      );

      return {
        id: updated.id,
        status: mapMPStatus(updated.status),
        productId: "",
        productName: updated.reason,
        customerId: String(updated.payer_id),
        currentPeriodEnd: updated.next_payment_date
          ? new Date(updated.next_payment_date)
          : undefined,
      };
    },

    async cancelSubscription(
      subscriptionId: string,
      _immediately = false
    ): Promise<Subscription> {
      const canceled = await mpFetch<MPPreapproval>(
        accessToken,
        `/preapproval/${subscriptionId}`,
        {
          method: "PUT",
          body: JSON.stringify({ status: "cancelled" }),
        }
      );

      return {
        id: canceled.id,
        status: "canceled",
        productId: "",
        productName: canceled.reason,
        customerId: String(canceled.payer_id),
        currentPeriodEnd: canceled.next_payment_date
          ? new Date(canceled.next_payment_date)
          : undefined,
        cancelAtPeriodEnd: false,
      };
    },

    async listSubscriptions(
      options: ListSubscriptionsOptions
    ): Promise<Subscription[]> {
      const params = new URLSearchParams();
      if (options.customerEmail) {
        params.set("payer_email", options.customerEmail);
      }
      if (options.status) {
        params.set("status", options.status);
      }
      if (options.limit) {
        params.set("limit", String(options.limit));
      }
      if (options.offset) {
        params.set("offset", String(options.offset));
      }

      const result = await mpFetch<MPSearchResult>(
        accessToken,
        `/preapproval/search?${params.toString()}`
      );

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
      const customer = await mpFetch<{ id: string; email: string }>(
        accessToken,
        "/v1/customers",
        {
          method: "POST",
          body: JSON.stringify({ email }),
        }
      );

      return {
        id: customer.id,
        email: customer.email,
        metadata,
      };
    },

    async getCustomer(customerId: string): Promise<Customer | null> {
      try {
        const customer = await mpFetch<{ id: string; email: string }>(
          accessToken,
          `/v1/customers/${customerId}`
        );

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
        const result = await mpFetch<{
          results: Array<{ id: string; email: string }>;
        }>(
          accessToken,
          `/v1/customers/search?email=${encodeURIComponent(email)}`
        );

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

      let mappedType: WebhookPayload["type"] = "subscription.updated";
      let subscription: Subscription | undefined;
      let customer: Customer | undefined;

      if (payload.type === "subscription_preapproval") {
        if (payload.action === "created") {
          mappedType = "subscription.created";
        } else if (payload.action === "updated") {
          mappedType = "subscription.updated";
        } else if (payload.action === "cancelled") {
          mappedType = "subscription.canceled";
        } else if (payload.action === "paused") {
          mappedType = "subscription.paused";
        } else if (payload.action === "authorized") {
          mappedType = "subscription.active";
        }

        if (payload.data?.id) {
          subscription = (await this.getSubscription(payload.data.id)) ?? undefined;
          if (subscription?.customerEmail) {
            customer = {
              id: subscription.customerId,
              email: subscription.customerEmail,
              metadata: subscription.metadata,
            };
          }
        }
      } else if (payload.type === "payment") {
        if (
          payload.action.includes("rejected") ||
          payload.action.includes("failed")
        ) {
          mappedType = "payment.failed";
        } else {
          mappedType = "payment.success";
        }
      }

      return {
        type: mappedType,
        provider: "mercadopago",
        subscription,
        customer,
        rawPayload: payload,
      };
    },
  };
}
