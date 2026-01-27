import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  CreatePreferenceData,
  MPChargebackResponse,
  MPInvoiceResponse,
  MPInvoiceSearchResponse,
  MPMerchantOrderResponse,
  MPPaymentResponse,
  MPPaymentSearchParams,
  MPPaymentSearchResponse,
  MPPreapproval,
  MPPreapprovalPlan,
  MPRefundResponse,
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
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Maximum retry attempts for 429/5xx errors (default: 3) */
  maxRetries?: number;
  /** Initial retry delay in milliseconds (default: 1000) */
  initialRetryDelay?: number;
};

const DEFAULT_BASE_URL = "https://api.mercadopago.com";
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_INITIAL_RETRY_DELAY = 1000;

// Retry constants
const RATE_LIMIT_STATUS = 429;
const SERVER_ERROR_MIN = 500;
const SERVER_ERROR_MAX = 600;
const RETRY_BACKOFF_BASE = 2;
const NO_CONTENT_STATUS = 204;

// ============================================================================
// Custom Error Class
// ============================================================================

export class MercadoPagoError extends Error {
  statusCode: number;
  errorCause?: unknown;
  retryable: boolean;

  constructor(
    message: string,
    statusCode: number,
    errorCause?: unknown,
    retryable = false
  ) {
    super(message);
    this.name = "MercadoPagoError";
    this.statusCode = statusCode;
    this.errorCause = errorCause;
    this.retryable = retryable;
  }
}

// ============================================================================
// Internal Helpers
// ============================================================================

function isRetryableStatus(status: number): boolean {
  return (
    status === RATE_LIMIT_STATUS ||
    (status >= SERVER_ERROR_MIN && status < SERVER_ERROR_MAX)
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type FetchResult<T> =
  | { success: true; data: T }
  | { success: false; shouldRetry: boolean; error: MercadoPagoError };

type AttemptFetchParams = {
  baseUrl: string;
  endpoint: string;
  accessToken: string;
  timeout: number;
  options?: RequestInit;
};

async function attemptFetch<T>(
  params: AttemptFetchParams
): Promise<FetchResult<T>> {
  const { baseUrl, endpoint, accessToken, timeout, options } = params;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...options?.headers,
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const error = errorBody as {
        message?: string;
        error?: string;
        cause?: unknown[];
      };

      const errorMessage =
        error.message ??
        error.error ??
        `Mercado Pago API error: ${response.status}`;

      return {
        success: false,
        shouldRetry: isRetryableStatus(response.status),
        error: new MercadoPagoError(
          errorMessage,
          response.status,
          error.cause,
          isRetryableStatus(response.status)
        ),
      };
    }

    // Handle empty responses (204 No Content)
    const contentLength = response.headers.get("content-length");
    if (response.status === NO_CONTENT_STATUS || contentLength === "0") {
      return { success: true, data: {} as T };
    }

    const data = (await response.json()) as T;
    return { success: true, data };
  } catch (err) {
    clearTimeout(timeoutId);

    // Handle abort (timeout)
    if (err instanceof Error && err.name === "AbortError") {
      return {
        success: false,
        shouldRetry: true,
        error: new MercadoPagoError(
          `Request timeout after ${timeout}ms`,
          0,
          err,
          true
        ),
      };
    }

    // Network errors are retryable
    if (err instanceof Error) {
      return {
        success: false,
        shouldRetry: true,
        error: new MercadoPagoError(err.message, 0, err, true),
      };
    }

    throw err;
  }
}

async function mpFetch<T>(
  config: MercadoPagoConfig,
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  const timeout = config.timeout ?? DEFAULT_TIMEOUT;
  const maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
  const initialRetryDelay =
    config.initialRetryDelay ?? DEFAULT_INITIAL_RETRY_DELAY;

  let lastError: MercadoPagoError | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await attemptFetch<T>({
      baseUrl,
      endpoint,
      accessToken: config.accessToken,
      timeout,
      options,
    });

    if (result.success) {
      return result.data;
    }

    lastError = result.error;

    // If retryable and we have retries left, wait and retry
    if (result.shouldRetry && attempt < maxRetries) {
      const delay = initialRetryDelay * RETRY_BACKOFF_BASE ** attempt;
      await sleep(delay);
      continue;
    }

    throw result.error;
  }

  throw lastError ?? new Error("Unexpected error in mpFetch");
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

function setSearchParam(
  params: URLSearchParams,
  key: string,
  value: string | number | undefined
): void {
  if (value !== undefined) {
    params.set(key, String(value));
  }
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
        // In production, this should be strict - return false
        // For development, we allow skipping validation
        return process.env.NODE_ENV !== "production";
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
    /**
     * Get payment details by ID
     *
     * @param paymentId - The payment ID (numeric or string)
     * @returns Payment details including status, amount, payer info
     *
     * @example
     * ```typescript
     * const payment = await mp.payments.get("123456789")
     * console.log(payment.status) // "approved"
     * ```
     */
    get(paymentId: string | number): Promise<MPPaymentResponse> {
      return mpFetch<MPPaymentResponse>(config, `/v1/payments/${paymentId}`);
    },

    /**
     * Create a new payment (card payment)
     *
     * @param data - Payment data including token, amount, payer info
     * @returns Created payment with ID and status
     *
     * @example
     * ```typescript
     * const payment = await mp.payments.create({
     *   token: "card_token_from_sdk",
     *   issuer_id: "visa",
     *   payment_method_id: "visa",
     *   transaction_amount: 100,
     *   installments: 1,
     *   payer: { email: "user@example.com" },
     * })
     * ```
     */
    create(data: ProcessPaymentData): Promise<ProcessPaymentResponse> {
      return mpFetch<ProcessPaymentResponse>(config, "/v1/payments", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },

    /**
     * Search payments with filters
     *
     * @param params - Search filters (date range, status, external_reference)
     * @returns Paginated list of payments
     *
     * @example
     * ```typescript
     * const results = await mp.payments.search({
     *   status: "approved",
     *   begin_date: "2024-01-01T00:00:00Z",
     *   end_date: "2024-12-31T23:59:59Z",
     *   limit: 50,
     * })
     * console.log(results.paging.total)
     * ```
     */
    search(params?: MPPaymentSearchParams): Promise<MPPaymentSearchResponse> {
      const searchParams = new URLSearchParams();

      setSearchParam(searchParams, "begin_date", params?.begin_date);
      setSearchParam(searchParams, "end_date", params?.end_date);
      setSearchParam(searchParams, "sort", params?.sort);
      setSearchParam(searchParams, "criteria", params?.criteria);
      setSearchParam(
        searchParams,
        "external_reference",
        params?.external_reference
      );
      setSearchParam(searchParams, "status", params?.status);
      setSearchParam(searchParams, "offset", params?.offset);
      setSearchParam(searchParams, "limit", params?.limit);

      const endpoint = buildSearchEndpoint("/v1/payments/search", searchParams);
      return mpFetch<MPPaymentSearchResponse>(config, endpoint);
    },

    /**
     * Create a refund for a payment
     *
     * @param paymentId - The payment ID to refund
     * @param amount - Optional partial refund amount. If not provided, full refund is created.
     * @returns Refund details with status
     *
     * @example
     * ```typescript
     * // Full refund
     * const refund = await mp.payments.refund("123456789")
     *
     * // Partial refund
     * const partialRefund = await mp.payments.refund("123456789", 50.00)
     * ```
     */
    refund(
      paymentId: string | number,
      amount?: number
    ): Promise<MPRefundResponse> {
      const body = amount !== undefined ? { amount } : {};
      return mpFetch<MPRefundResponse>(
        config,
        `/v1/payments/${paymentId}/refunds`,
        {
          method: "POST",
          body: JSON.stringify(body),
        }
      );
    },

    /**
     * Get all refunds for a payment
     *
     * @param paymentId - The payment ID
     * @returns Array of refunds for the payment
     *
     * @example
     * ```typescript
     * const refunds = await mp.payments.getRefunds("123456789")
     * const totalRefunded = refunds.reduce((sum, r) => sum + r.amount, 0)
     * ```
     */
    getRefunds(paymentId: string | number): Promise<MPRefundResponse[]> {
      return mpFetch<MPRefundResponse[]>(
        config,
        `/v1/payments/${paymentId}/refunds`
      );
    },
  };
}

// ============================================================================
// Plans Module
// ============================================================================

function createPlansModule(config: MercadoPagoConfig) {
  return {
    /**
     * List subscription plans
     *
     * @param params - Filter options (status, pagination)
     * @returns List of preapproval plans
     *
     * @example
     * ```typescript
     * const { results } = await mp.plans.list({ status: "active" })
     * ```
     */
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

    /**
     * Get a subscription plan by ID
     *
     * @param planId - The plan ID
     * @returns Plan details
     *
     * @example
     * ```typescript
     * const plan = await mp.plans.get("2c9380848...")
     * console.log(plan.reason, plan.auto_recurring.transaction_amount)
     * ```
     */
    get(planId: string): Promise<MPPreapprovalPlan> {
      return mpFetch<MPPreapprovalPlan>(config, `/preapproval_plan/${planId}`);
    },

    /**
     * Create a new subscription plan
     *
     * @param data - Plan configuration including name, frequency, and amount
     * @returns Created plan with init_point for checkout
     *
     * @example
     * ```typescript
     * const plan = await mp.plans.create({
     *   reason: "Premium Monthly",
     *   auto_recurring: {
     *     frequency: 1,
     *     frequency_type: "months",
     *     transaction_amount: 1500,
     *     currency_id: "UYU",
     *   },
     *   back_url: "https://your-site.com/callback",
     * })
     * console.log(plan.init_point) // Checkout URL
     * ```
     */
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

    /**
     * Update a subscription plan
     *
     * @param planId - The plan ID to update
     * @param data - Fields to update (reason, amount, billing_day)
     * @returns Updated plan
     *
     * @example
     * ```typescript
     * const updated = await mp.plans.update("plan_123", {
     *   auto_recurring: { transaction_amount: 2000 },
     * })
     * ```
     */
    update(
      planId: string,
      data: {
        reason?: string;
        auto_recurring?: {
          transaction_amount?: number;
          billing_day?: number;
          billing_day_proportional?: boolean;
        };
        back_url?: string;
      }
    ): Promise<MPPreapprovalPlan> {
      return mpFetch<MPPreapprovalPlan>(config, `/preapproval_plan/${planId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },

    /**
     * Deactivate (set to inactive) a subscription plan
     */
    deactivate(planId: string): Promise<MPPreapprovalPlan> {
      return mpFetch<MPPreapprovalPlan>(config, `/preapproval_plan/${planId}`, {
        method: "PUT",
        body: JSON.stringify({ status: "inactive" }),
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
    /**
     * Create a new subscription
     */
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

    /**
     * Get a subscription by ID
     */
    get(subscriptionId: string): Promise<MPSubscriptionResponse> {
      return mpFetch<MPSubscriptionResponse>(
        config,
        `/preapproval/${subscriptionId}`
      );
    },

    update,

    /**
     * Cancel a subscription
     */
    cancel(subscriptionId: string): Promise<MPSubscriptionResponse> {
      return update(subscriptionId, { status: "cancelled" });
    },

    /**
     * Pause a subscription
     */
    pause(subscriptionId: string): Promise<MPSubscriptionResponse> {
      return update(subscriptionId, { status: "paused" });
    },

    /**
     * Resume a paused subscription
     */
    resume(subscriptionId: string): Promise<MPSubscriptionResponse> {
      return update(subscriptionId, { status: "authorized" });
    },

    /**
     * Search subscriptions with filters
     */
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

    /**
     * List invoices (authorized payments) for a subscription
     */
    listInvoices(
      subscriptionId: string,
      params?: {
        status?: string;
        limit?: number;
        offset?: number;
      }
    ): Promise<MPInvoiceSearchResponse> {
      const searchParams = new URLSearchParams();
      searchParams.set("preapproval_id", subscriptionId);

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
        "/authorized_payments/search",
        searchParams
      );
      return mpFetch<MPInvoiceSearchResponse>(config, endpoint);
    },
  };
}

// ============================================================================
// Customers Module
// ============================================================================

function createCustomersModule(config: MercadoPagoConfig) {
  return {
    /**
     * Create a new customer
     */
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

    /**
     * Get a customer by ID
     */
    get(customerId: string): Promise<{ id: string; email: string }> {
      return mpFetch<{ id: string; email: string }>(
        config,
        `/v1/customers/${customerId}`
      );
    },

    /**
     * Search customers by email
     */
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
    /**
     * Create a checkout preference
     */
    createPreference(data: CreatePreferenceData): Promise<PreferenceResponse> {
      return mpFetch<PreferenceResponse>(config, "/checkout/preferences", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },

    /**
     * Get a checkout preference by ID
     */
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
    /**
     * Get an invoice (authorized payment) by ID
     */
    get(invoiceId: string): Promise<MPInvoiceResponse> {
      return mpFetch<MPInvoiceResponse>(
        config,
        `/authorized_payments/${invoiceId}`
      );
    },

    /**
     * Search invoices with filters
     */
    search(params?: {
      preapproval_id?: string;
      status?: string;
      limit?: number;
      offset?: number;
    }): Promise<MPInvoiceSearchResponse> {
      const searchParams = new URLSearchParams();

      if (params?.preapproval_id) {
        searchParams.set("preapproval_id", params.preapproval_id);
      }
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
        "/authorized_payments/search",
        searchParams
      );
      return mpFetch<MPInvoiceSearchResponse>(config, endpoint);
    },
  };
}

// ============================================================================
// Merchant Orders Module
// ============================================================================

function createMerchantOrdersModule(config: MercadoPagoConfig) {
  return {
    /**
     * Get a merchant order by ID
     */
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
    /**
     * Get a chargeback by ID
     */
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
 *   timeout: 30000, // 30 seconds
 *   maxRetries: 3,
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
 * // Search payments
 * const payments = await mp.payments.search({
 *   begin_date: "2024-01-01T00:00:00Z",
 *   status: "approved",
 * })
 *
 * // Refund a payment (full)
 * const refund = await mp.payments.refund("123456")
 *
 * // Refund a payment (partial)
 * const partialRefund = await mp.payments.refund("123456", 50.00)
 *
 * // List subscription invoices
 * const invoices = await mp.subscriptions.listInvoices("sub_123")
 *
 * // Deactivate a plan
 * await mp.plans.deactivate("plan_123")
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
