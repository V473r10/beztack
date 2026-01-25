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
// Plan Types and Schemas
// ============================================================================

export const frequencyTypeSchema = z.enum(["days", "months"]);
export type FrequencyType = z.infer<typeof frequencyTypeSchema>;

export const planStatusSchema = z.enum(["active", "inactive"]);
export type PlanStatus = z.infer<typeof planStatusSchema>;

// Schema for creating a plan
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

// Plan from API/Database
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

// API Response types
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
// Subscription Types and Schemas
// ============================================================================

export const subscriptionStatusSchema = z.enum([
  "pending",
  "authorized",
  "active",
  "paused",
  "cancelled",
]);
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

// Schema for creating a subscription with a plan
export const createSubscriptionSchema = z.object({
  preapproval_plan_id: z.string().min(1, "Plan ID is required"),
  payer_email: z.string().email("Invalid email address"),
  card_token_id: z.string().optional(),
  back_url: z.string().url().optional(),
  external_reference: z.string().optional(),
});

export type CreateSubscriptionData = z.infer<typeof createSubscriptionSchema>;

// Subscription from API/Database
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

// API Response for subscription creation
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
// Utility functions
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
