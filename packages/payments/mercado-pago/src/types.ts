import { z } from "zod";

// ============================================================================
// Constants
// ============================================================================

const MIN_PLAN_NAME_LENGTH = 3;
const MAX_PLAN_NAME_LENGTH = 100;
const MIN_FREQUENCY = 1;
const MAX_FREQUENCY = 12;
const MAX_TRANSACTION_AMOUNT = 1_000_000;
const MIN_BILLING_DAY = 1;
const MAX_BILLING_DAY = 28;

// ============================================================================
// Enums and Base Types
// ============================================================================

export const frequencyTypeSchema = z.enum(["days", "months"]);
export type FrequencyType = z.infer<typeof frequencyTypeSchema>;

export const planStatusSchema = z.enum(["active", "inactive"]);
export type PlanStatus = z.infer<typeof planStatusSchema>;

export const subscriptionStatusSchema = z.enum([
  "pending",
  "authorized",
  "active",
  "paused",
  "cancelled",
]);
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

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

// ============================================================================
// Plan Schemas and Types
// ============================================================================

export const createPlanSchema = z.object({
  reason: z
    .string()
    .min(MIN_PLAN_NAME_LENGTH, "Plan name must be at least 3 characters")
    .max(MAX_PLAN_NAME_LENGTH, "Plan name must be less than 100 characters"),
  auto_recurring: z.object({
    frequency: z
      .number()
      .int()
      .min(MIN_FREQUENCY, "Frequency must be at least 1")
      .max(MAX_FREQUENCY, "Frequency must be at most 12"),
    frequency_type: frequencyTypeSchema,
    transaction_amount: z
      .number()
      .positive("Amount must be positive")
      .max(MAX_TRANSACTION_AMOUNT, "Amount is too large"),
    currency_id: z.string().min(1, "Currency is required"),
    repetitions: z.number().int().positive().optional(),
    billing_day: z
      .number()
      .int()
      .min(MIN_BILLING_DAY)
      .max(MAX_BILLING_DAY)
      .optional(),
    billing_day_proportional: z.boolean().optional(),
    free_trial: z
      .object({
        frequency: z.number().int().min(MIN_FREQUENCY),
        frequency_type: frequencyTypeSchema,
      })
      .optional(),
  }),
  back_url: z.string().url().optional(),
});

export type CreatePlanData = z.infer<typeof createPlanSchema>;

export type Plan = {
  id: string;
  status: string;
  reason: string;
  frequency: number;
  frequencyType: string;
  transactionAmount: number | string;
  currencyId: string;
  repetitions?: number | null;
  billingDay?: number | null;
  initPoint: string;
  backUrl?: string | null;
  dateCreated: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type PlansResponse = {
  plans: Plan[];
  syncedAt: string | null;
  total: number;
};

export type CreatePlanResponse = {
  id: string;
  status: string;
  reason: string;
  frequency: number;
  frequencyType: string;
  transactionAmount: number;
  currencyId: string;
  repetitions?: number;
  initPoint: string;
  backUrl: string;
  dateCreated: string;
};

export type SyncPlansResponse = {
  success: boolean;
  syncedAt: string;
  duration: string;
  stats: {
    created: number;
    updated: number;
    total: number;
  };
};

// ============================================================================
// Subscription Schemas and Types
// ============================================================================

export const createSubscriptionSchema = z.object({
  preapproval_plan_id: z.string().min(1, "Plan ID is required"),
  payer_email: z.string().email("Invalid email address"),
  card_token_id: z.string().optional(),
  back_url: z.string().url().optional(),
  external_reference: z.string().optional(),
});

export type CreateSubscriptionData = z.infer<typeof createSubscriptionSchema>;

export type Subscription = {
  id: string;
  status: string;
  reason?: string | null;
  payerEmail?: string | null;
  preapprovalPlanId?: string | null;
  frequency?: number | null;
  frequencyType?: string | null;
  transactionAmount?: number | string | null;
  currencyId?: string | null;
  initPoint?: string | null;
  nextPaymentDate?: string | null;
  dateCreated?: string | null;
};

export type CreateSubscriptionResponse =
  | {
      mode: "checkout";
      plan: Plan;
      checkoutUrl: string;
    }
  | {
      mode: "authorized";
      subscription: Subscription;
    };

export type SubscriptionsSearchResponse = {
  subscriptions: Subscription[];
  total: number;
};

// ============================================================================
// Mercado Pago API Response Types
// ============================================================================

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

export type MPPreapprovalPlan = {
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
  back_url?: string;
};

export type MPPreapproval = {
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
  preapproval_plan_id?: string;
};

// ============================================================================
// Preference Types (Checkout Pro)
// ============================================================================

export type PreferenceItem = {
  id?: string;
  title: string;
  description?: string;
  picture_url?: string;
  category_id?: string;
  quantity: number;
  currency_id?: string;
  unit_price: number;
};

export type PreferenceBackUrls = {
  success?: string;
  pending?: string;
  failure?: string;
};

export type PreferencePayer = {
  name?: string;
  surname?: string;
  email?: string;
  phone?: {
    area_code?: string;
    number?: string;
  };
  identification?: {
    type?: string;
    number?: string;
  };
  address?: {
    zip_code?: string;
    street_name?: string;
    street_number?: number;
  };
};

export type CreatePreferenceData = {
  items: PreferenceItem[];
  payer?: PreferencePayer;
  back_urls?: PreferenceBackUrls;
  auto_return?: "approved" | "all";
  external_reference?: string;
  notification_url?: string;
  expires?: boolean;
  expiration_date_from?: string;
  expiration_date_to?: string;
};

export type PreferenceResponse = {
  id: string;
  init_point: string;
  sandbox_init_point: string;
  date_created: string;
  items: PreferenceItem[];
  payer?: PreferencePayer;
  back_urls?: PreferenceBackUrls;
  external_reference?: string;
};

// ============================================================================
// Payment Processing Types
// ============================================================================

export type ProcessPaymentData = {
  token: string;
  issuer_id: string | number;
  payment_method_id: string;
  transaction_amount: number;
  installments: number;
  description?: string;
  payer: {
    email: string;
    identification?: {
      type: string;
      number: string;
    };
  };
};

export type ProcessPaymentResponse = {
  id: number;
  status: string;
  status_detail: string;
  date_created?: string;
  date_approved?: string;
};

// ============================================================================
// Utility Functions
// ============================================================================

export function formatPlanPrice(
  amount: number | string,
  currencyId: string
): string {
  const numAmount =
    typeof amount === "string" ? Number.parseFloat(amount) : amount;
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: currencyId,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numAmount);
}

export function formatFrequency(
  frequency: number,
  frequencyType: string
): string {
  const typeLabel = frequencyType === "months" ? "mes" : "día";
  const plural = frequency > 1 ? (frequencyType === "months" ? "es" : "s") : "";

  if (frequency === 1) {
    return `cada ${typeLabel}`;
  }
  return `cada ${frequency} ${typeLabel}${plural}`;
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: "Pendiente",
    authorized: "Autorizada",
    active: "Activa",
    paused: "Pausada",
    cancelled: "Cancelada",
    inactive: "Inactivo",
  };
  return labels[status] || status;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: "bg-yellow-500",
    authorized: "bg-blue-500",
    active: "bg-green-500",
    paused: "bg-orange-500",
    cancelled: "bg-red-500",
    inactive: "bg-gray-500",
  };
  return colors[status] || "bg-gray-500";
}

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
