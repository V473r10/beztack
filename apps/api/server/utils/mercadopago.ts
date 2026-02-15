import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/env";

const MP_API_BASE = "https://api.mercadopago.com";

// =============================================================================
// Types
// =============================================================================

export type WebhookPayload = {
  id: number;
  live_mode: boolean;
  type: string;
  date_created: string;
  user_id: number;
  api_version: string;
  action: string;
  data: {
    id: string;
  };
};

export type PaymentStatus =
  | "pending"
  | "approved"
  | "authorized"
  | "in_process"
  | "in_mediation"
  | "rejected"
  | "cancelled"
  | "refunded"
  | "charged_back";

export type SubscriptionStatus =
  | "pending"
  | "authorized"
  | "paused"
  | "cancelled";

export type MPPaymentResponse = {
  id?: number;
  date_created?: string;
  date_approved?: string;
  date_last_updated?: string;
  money_release_date?: string;
  operation_type?: string;
  issuer_id?: string;
  payment_method_id?: string;
  payment_type_id?: string;
  status?: string;
  status_detail?: string;
  currency_id?: string;
  description?: string;
  live_mode?: boolean;
  collector_id?: number;
  payer?: {
    id?: string;
    email?: string;
    identification?: {
      type?: string;
      number?: string;
    };
  };
  external_reference?: string;
  transaction_amount?: number;
  transaction_amount_refunded?: number;
  net_received_amount?: number;
  installments?: number;
  statement_descriptor?: string;
  card?: {
    first_six_digits?: string;
    last_four_digits?: string;
  };
  order?: {
    id?: number;
    type?: string;
  };
  refunds?: {
    id?: number;
    payment_id?: number;
    amount?: number;
    status?: string;
    reason?: string;
    date_created?: string;
    unique_sequence_number?: string;
    refund_mode?: string;
    adjustment_amount?: number;
    amount_refunded_to_payer?: number;
    source?: {
      id?: string;
      name?: string;
      type?: string;
    };
  }[];
  transaction_details?: {
    net_received_amount?: number;
    total_paid_amount?: number;
    overpaid_amount?: number;
    installment_amount?: number;
  };
};

export type MPSubscriptionResponse = {
  id?: string;
  payer_id?: number;
  payer_email?: string;
  collector_id?: number;
  application_id?: number;
  status?: string;
  reason?: string;
  external_reference?: string;
  date_created?: string;
  last_modified?: string;
  init_point?: string;
  preapproval_plan_id?: string;
  auto_recurring?: {
    frequency?: number;
    frequency_type?: string;
    transaction_amount?: number;
    currency_id?: string;
  };
  summarized?: {
    charged_quantity?: number;
    charged_amount?: number;
    pending_charge_amount?: number;
  };
  payment_method_id?: string;
  next_payment_date?: string;
  back_url?: string;
};

export type MPInvoiceResponse = {
  id?: string;
  preapproval_id?: string;
  payer_id?: number;
  external_reference?: string;
  status?: string;
  reason?: string;
  transaction_amount?: number;
  currency_id?: string;
  type?: string;
  retry_attempt?: number;
  debit_date?: string;
  date_created?: string;
  last_modified?: string;
  payment?: {
    id?: string;
    status?: string;
    status_detail?: string;
  };
};

export type MPMerchantOrderResponse = {
  id?: number;
  preference_id?: string;
  application_id?: string;
  status?: string;
  site_id?: string;
  payer?: {
    id?: number;
    nickname?: string;
  };
  collector?: {
    id?: number;
    nickname?: string;
  };
  payments?: {
    id?: number;
    transaction_amount?: number;
    total_paid_amount?: number;
    status?: string;
    date_approved?: string;
    date_created?: string;
    amount_refunded?: number;
  }[];
  paid_amount?: number;
  refunded_amount?: number;
  shipping_cost?: number;
  date_created?: string;
  cancelled?: boolean;
  external_reference?: string;
  total_amount?: number;
  order_status?: string;
  last_updated?: string;
  notification_url?: string;
  additional_info?: string;
  is_test?: boolean;
};

export type MPChargebackResponse = {
  id?: string;
  payments?: number[];
  currency_id?: string;
  amount?: number;
  coverage_applied?: boolean;
  coverage_eligible?: boolean;
  documentation_required?: boolean;
  documentation_status?: string;
  documentation?: {
    files?: { type?: string; url?: string }[];
  };
  date_documentation_deadline?: string;
  date_created?: string;
  date_last_updated?: string;
  live_mode?: boolean;
  reason?: {
    code?: string;
    description?: string;
  };
  status?: string;
  stage?: string;
  resolution?: string;
};

// =============================================================================
// HMAC Signature Validation
// =============================================================================

/**
 * Validates Mercado Pago webhook signature
 * @see https://www.mercadopago.com.uy/developers/es/docs/checkout-pro/additional-content/notifications/webhooks
 */
export function validateWebhookSignature(
  xSignature: string | null,
  xRequestId: string | null,
  dataId: string
): boolean {
  const secret = env.MERCADO_PAGO_WEBHOOK_SECRET;

  // If no secret configured, skip validation (development mode)
  if (!secret) {
    // biome-ignore lint/suspicious/noConsole: Warning for missing webhook secret
    console.warn(
      "[MP Webhook] MERCADO_PAGO_WEBHOOK_SECRET not configured, skipping signature validation"
    );
    return true;
  }

  if (!(xSignature && xRequestId)) {
    return false;
  }

  // Parse x-signature header: "ts=timestamp,v1=hash"
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
    return false;
  }

  // Build the manifest string as per MP docs
  // Template: id:[data.id];request-id:[x-request-id];ts:[ts];
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

  // Generate HMAC-SHA256
  const hmac = createHmac("sha256", secret);
  hmac.update(manifest);
  const generatedSignature = hmac.digest("hex");

  // Timing-safe comparison
  try {
    return timingSafeEqual(Buffer.from(v1), Buffer.from(generatedSignature));
  } catch {
    return false;
  }
}

// =============================================================================
// API Fetch Helpers
// =============================================================================

async function mpFetch<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${MP_API_BASE}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.MERCADO_PAGO_ACCESS_TOKEN}`,
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

/**
 * Fetch payment details from Mercado Pago API
 */
export function fetchPayment(paymentId: string): Promise<MPPaymentResponse> {
  return mpFetch<MPPaymentResponse>(`/v1/payments/${paymentId}`);
}

/**
 * Fetch subscription (preapproval) details from Mercado Pago API
 */
export function fetchSubscription(
  subscriptionId: string
): Promise<MPSubscriptionResponse> {
  return mpFetch<MPSubscriptionResponse>(`/preapproval/${subscriptionId}`);
}

/**
 * Fetch invoice (authorized_payment) details from Mercado Pago API
 */
export function fetchInvoice(invoiceId: string): Promise<MPInvoiceResponse> {
  return mpFetch<MPInvoiceResponse>(`/authorized_payments/${invoiceId}`);
}

/**
 * Fetch merchant order details from Mercado Pago API
 */
export function fetchMerchantOrder(
  orderId: string
): Promise<MPMerchantOrderResponse> {
  return mpFetch<MPMerchantOrderResponse>(`/merchant_orders/${orderId}`);
}

/**
 * Fetch chargeback details from Mercado Pago API
 */
export function fetchChargeback(
  chargebackId: string
): Promise<MPChargebackResponse> {
  return mpFetch<MPChargebackResponse>(`/v1/chargebacks/${chargebackId}`);
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Parse optional date string to Date object
 */
export function parseDate(dateStr: string | undefined | null): Date | null {
  if (!dateStr) {
    return null;
  }
  const date = new Date(dateStr);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Safe string conversion for numeric IDs
 */
export function toStringId(
  id: number | string | undefined | null
): string | null {
  if (id === undefined || id === null) {
    return null;
  }
  return String(id);
}
