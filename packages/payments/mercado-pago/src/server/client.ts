import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  CreatePreferenceData,
  MPChargebackResponse,
  MPInvoiceResponse,
  MPMerchantOrderResponse,
  MPPaymentResponse,
  MPPreapproval,
  MPPreapprovalPlan,
  MPSubscriptionResponse,
  PreferenceResponse,
  ProcessPaymentData,
  ProcessPaymentResponse,
  WebhookPayload,
} from "../types.js";

// ============================================================================
// Configuration
// ============================================================================

export type MercadoPagoConfig = {
  accessToken: string;
  webhookSecret?: string;
  baseUrl?: string;
};

const DEFAULT_BASE_URL = "https://api.mercadopago.com";

// ============================================================================
// Internal Helpers
// ============================================================================

async function mpFetch<T>(
  config: MercadoPagoConfig,
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.accessToken}`,
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    throw new Error(
      error.message ?? `Mercado Pago API error: ${response.status}`
    );
  }

  return response.json() as Promise<T>;
}

function parseSignatureHeader(
  xSignature: string
): { ts: string; v1: string } | null {
  const parts = xSignature.split(",");
  let ts: string | undefined;
  let v1: string | undefined;

  for (const part of parts) {
    const [key, value] = part.split("=");
    if (key === "ts") {
      ts = value;
    }
    if (key === "v1") {
      v1 = value;
    }
  }

  if (!(ts && v1)) {
    return null;
  }

  return { ts, v1 };
}

function buildSearchEndpoint(
  basePath: string,
  params: URLSearchParams
): string {
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

// ============================================================================
// Webhooks Module
// ============================================================================

function createWebhooksModule(config: MercadoPagoConfig) {
  return {
    /**
     * Validates Mercado Pago webhook signature using HMAC-SHA256
     * @see https://www.mercadopago.com.uy/developers/es/docs/checkout-pro/additional-content/notifications/webhooks
     */
    validate(
      xSignature: string | null,
      xRequestId: string | null,
      dataId: string
    ): boolean {
      const secret = config.webhookSecret;

      if (!secret) {
        console.warn(
          "[MercadoPago SDK] webhookSecret not configured, skipping validation"
        );
        return true;
      }

      if (!(xSignature && xRequestId)) {
        return false;
      }

      const parsed = parseSignatureHeader(xSignature);
      if (!parsed) {
        return false;
      }

      const { ts, v1 } = parsed;
      const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

      const hmac = createHmac("sha256", secret);
      hmac.update(manifest);
      const generatedSignature = hmac.digest("hex");

      try {
        return timingSafeEqual(
          Buffer.from(v1),
          Buffer.from(generatedSignature)
        );
      } catch {
        return false;
      }
    },

    /**
     * Parse raw webhook body into typed payload
     */
    parse(rawBody: string): WebhookPayload {
      return JSON.parse(rawBody) as WebhookPayload;
    },
  };
}

// ============================================================================
// Payments Module
// ============================================================================

function createPaymentsModule(config: MercadoPagoConfig) {
  return {
    get(paymentId: string | number): Promise<MPPaymentResponse> {
      return mpFetch<MPPaymentResponse>(config, `/v1/payments/${paymentId}`);
    },

    create(data: ProcessPaymentData): Promise<ProcessPaymentResponse> {
      return mpFetch<ProcessPaymentResponse>(config, "/v1/payments", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
  };
}

// ============================================================================
// Plans Module
// ============================================================================

function createPlansModule(config: MercadoPagoConfig) {
  return {
    list(params?: {
      status?: string;
      limit?: number;
      offset?: number;
    }): Promise<{ results: MPPreapprovalPlan[] }> {
      const searchParams = new URLSearchParams();
      if (params?.status) {
        searchParams.set("status", params.status);
      }
      if (params?.limit) {
        searchParams.set("limit", String(params.limit));
      }
      if (params?.offset) {
        searchParams.set("offset", String(params.offset));
      }

      const endpoint = buildSearchEndpoint(
        "/preapproval_plan/search",
        searchParams
      );
      return mpFetch<{ results: MPPreapprovalPlan[] }>(config, endpoint);
    },

    get(planId: string): Promise<MPPreapprovalPlan> {
      return mpFetch<MPPreapprovalPlan>(config, `/preapproval_plan/${planId}`);
    },

    create(data: {
      reason: string;
      auto_recurring: {
        frequency: number;
        frequency_type: "days" | "months";
        transaction_amount: number;
        currency_id: string;
        repetitions?: number;
        billing_day?: number;
        billing_day_proportional?: boolean;
        free_trial?: {
          frequency: number;
          frequency_type: "days" | "months";
        };
      };
      back_url?: string;
    }): Promise<MPPreapprovalPlan> {
      return mpFetch<MPPreapprovalPlan>(config, "/preapproval_plan", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
  };
}

// ============================================================================
// Subscriptions Module
// ============================================================================

function createSubscriptionsModule(config: MercadoPagoConfig) {
  const update = (
    subscriptionId: string,
    data: {
      status?: "paused" | "authorized" | "cancelled";
      reason?: string;
      external_reference?: string;
    }
  ): Promise<MPSubscriptionResponse> => {
    return mpFetch<MPSubscriptionResponse>(
      config,
      `/preapproval/${subscriptionId}`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      }
    );
  };

  return {
    create(data: {
      preapproval_plan_id?: string;
      payer_email: string;
      card_token_id?: string;
      back_url?: string;
      external_reference?: string;
      reason?: string;
      auto_recurring?: {
        frequency: number;
        frequency_type: "days" | "months";
        transaction_amount: number;
        currency_id: string;
      };
      status?: "pending" | "authorized";
    }): Promise<MPPreapproval> {
      return mpFetch<MPPreapproval>(config, "/preapproval", {
        method: "POST",
        body: JSON.stringify({ ...data, status: data.status ?? "pending" }),
      });
    },

    get(subscriptionId: string): Promise<MPSubscriptionResponse> {
      return mpFetch<MPSubscriptionResponse>(
        config,
        `/preapproval/${subscriptionId}`
      );
    },

    update,

    cancel(subscriptionId: string): Promise<MPSubscriptionResponse> {
      return update(subscriptionId, { status: "cancelled" });
    },

    pause(subscriptionId: string): Promise<MPSubscriptionResponse> {
      return update(subscriptionId, { status: "paused" });
    },

    resume(subscriptionId: string): Promise<MPSubscriptionResponse> {
      return update(subscriptionId, { status: "authorized" });
    },

    search(params?: {
      payer_email?: string;
      status?: string;
      preapproval_plan_id?: string;
      limit?: number;
      offset?: number;
    }): Promise<{ results: MPPreapproval[]; paging: { total: number } }> {
      const searchParams = new URLSearchParams();
      if (params?.payer_email) {
        searchParams.set("payer_email", params.payer_email);
      }
      if (params?.status) {
        searchParams.set("status", params.status);
      }
      if (params?.preapproval_plan_id) {
        searchParams.set("preapproval_plan_id", params.preapproval_plan_id);
      }
      if (params?.limit) {
        searchParams.set("limit", String(params.limit));
      }
      if (params?.offset) {
        searchParams.set("offset", String(params.offset));
      }

      const endpoint = buildSearchEndpoint("/preapproval/search", searchParams);
      return mpFetch<{ results: MPPreapproval[]; paging: { total: number } }>(
        config,
        endpoint
      );
    },
  };
}

// ============================================================================
// Customers Module
// ============================================================================

function createCustomersModule(config: MercadoPagoConfig) {
  return {
    create(data: {
      email: string;
      first_name?: string;
      last_name?: string;
    }): Promise<{ id: string; email: string }> {
      return mpFetch<{ id: string; email: string }>(config, "/v1/customers", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },

    get(customerId: string): Promise<{ id: string; email: string }> {
      return mpFetch<{ id: string; email: string }>(
        config,
        `/v1/customers/${customerId}`
      );
    },

    searchByEmail(
      email: string
    ): Promise<{ results: { id: string; email: string }[] }> {
      return mpFetch<{ results: { id: string; email: string }[] }>(
        config,
        `/v1/customers/search?email=${encodeURIComponent(email)}`
      );
    },
  };
}

// ============================================================================
// Checkout Module (Preferences)
// ============================================================================

function createCheckoutModule(config: MercadoPagoConfig) {
  return {
    createPreference(data: CreatePreferenceData): Promise<PreferenceResponse> {
      return mpFetch<PreferenceResponse>(config, "/checkout/preferences", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },

    getPreference(preferenceId: string): Promise<PreferenceResponse> {
      return mpFetch<PreferenceResponse>(
        config,
        `/checkout/preferences/${preferenceId}`
      );
    },
  };
}

// ============================================================================
// Invoices Module (Authorized Payments)
// ============================================================================

function createInvoicesModule(config: MercadoPagoConfig) {
  return {
    get(invoiceId: string): Promise<MPInvoiceResponse> {
      return mpFetch<MPInvoiceResponse>(
        config,
        `/authorized_payments/${invoiceId}`
      );
    },
  };
}

// ============================================================================
// Merchant Orders Module
// ============================================================================

function createMerchantOrdersModule(config: MercadoPagoConfig) {
  return {
    get(orderId: string): Promise<MPMerchantOrderResponse> {
      return mpFetch<MPMerchantOrderResponse>(
        config,
        `/merchant_orders/${orderId}`
      );
    },
  };
}

// ============================================================================
// Chargebacks Module
// ============================================================================

function createChargebacksModule(config: MercadoPagoConfig) {
  return {
    get(chargebackId: string): Promise<MPChargebackResponse> {
      return mpFetch<MPChargebackResponse>(
        config,
        `/v1/chargebacks/${chargebackId}`
      );
    },
  };
}

// ============================================================================
// Main Client Factory
// ============================================================================

export type MercadoPagoClient = {
  config: MercadoPagoConfig;
  webhooks: ReturnType<typeof createWebhooksModule>;
  payments: ReturnType<typeof createPaymentsModule>;
  plans: ReturnType<typeof createPlansModule>;
  subscriptions: ReturnType<typeof createSubscriptionsModule>;
  customers: ReturnType<typeof createCustomersModule>;
  checkout: ReturnType<typeof createCheckoutModule>;
  invoices: ReturnType<typeof createInvoicesModule>;
  merchantOrders: ReturnType<typeof createMerchantOrdersModule>;
  chargebacks: ReturnType<typeof createChargebacksModule>;
};

/**
 * Create a Mercado Pago client instance
 *
 * @example
 * ```typescript
 * const mp = createMercadoPagoClient({
 *   accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN,
 *   webhookSecret: process.env.MERCADO_PAGO_WEBHOOK_SECRET,
 * })
 *
 * // Create a preference
 * const preference = await mp.checkout.createPreference({
 *   items: [{ title: "Product", quantity: 1, unit_price: 100 }],
 * })
 *
 * // Get a payment
 * const payment = await mp.payments.get("123456")
 *
 * // Validate webhook
 * const isValid = mp.webhooks.validate(xSignature, xRequestId, dataId)
 * ```
 */
export function createMercadoPagoClient(
  config: MercadoPagoConfig
): MercadoPagoClient {
  return {
    config,
    webhooks: createWebhooksModule(config),
    payments: createPaymentsModule(config),
    plans: createPlansModule(config),
    subscriptions: createSubscriptionsModule(config),
    customers: createCustomersModule(config),
    checkout: createCheckoutModule(config),
    invoices: createInvoicesModule(config),
    merchantOrders: createMerchantOrdersModule(config),
    chargebacks: createChargebacksModule(config),
  };
}
