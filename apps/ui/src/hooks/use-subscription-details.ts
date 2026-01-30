/**
 * Hook for fetching subscription details from Mercado Pago
 * Used primarily for the subscription welcome page after checkout redirect
 */
import { useQuery } from "@tanstack/react-query";
import { env } from "@/env";

const API_URL = env.VITE_API_URL;

// Time constants
const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;
const STALE_TIME_MINUTES = 5;
const STALE_TIME_MS = STALE_TIME_MINUTES * SECONDS_PER_MINUTE * MS_PER_SECOND;

// Retry constants
const MAX_RETRY_COUNT = 2;

// Frequency constants
const MONTHS_PER_YEAR = 12;
const DAYS_PER_WEEK = 7;

// HTTP status codes
const HTTP_NOT_FOUND = 404;
const HTTP_FORBIDDEN = 403;

/**
 * Raw response from Mercado Pago subscription endpoint
 */
export type MPSubscriptionResponse = {
  id: string;
  status: "pending" | "authorized" | "paused" | "cancelled" | "active";
  reason: string | null;
  payer_email: string;
  payer_id: string;
  external_reference: string | null;
  preapproval_plan_id: string | null;
  init_point: string;
  back_url: string | null;
  auto_recurring: {
    frequency: number;
    frequency_type: "days" | "months";
    transaction_amount: number;
    currency_id: string;
    start_date: string;
    end_date: string | null;
  };
  summarized: {
    quotas: number | null;
    charged_quantity: number;
    pending_charge_quantity: number;
    charged_amount: number;
    pending_charge_amount: number;
    semaphore: string | null;
    last_charged_date: string | null;
    last_charged_amount: number | null;
  };
  next_payment_date: string | null;
  payment_method_id: string | null;
  payment_method_id_secondary: string | null;
  first_invoice_offset: number | null;
  date_created: string;
  last_modified: string;
};

/**
 * Transformed subscription data for UI consumption
 */
export type SubscriptionDetails = {
  id: string;
  status: "pending" | "authorized" | "paused" | "cancelled" | "active";
  plan: {
    name: string;
    description: string | null;
  };
  price: {
    amount: number;
    currency: string;
    frequency: number;
    frequencyType: "days" | "months";
  };
  payer: {
    email: string;
    id: string;
  };
  dates: {
    created: Date;
    nextPayment: Date | null;
    startDate: Date;
    endDate: Date | null;
  };
  billing: {
    chargedQuantity: number;
    chargedAmount: number;
    pendingAmount: number;
  };
  paymentMethod: string | null;
  externalReference: string | null;
};

/**
 * Transform raw MP response to a cleaner format
 */
function transformSubscription(
  raw: MPSubscriptionResponse
): SubscriptionDetails {
  return {
    id: raw.id,
    status: raw.status,
    plan: {
      name: raw.reason || "Suscripción",
      description: null,
    },
    price: {
      amount: raw.auto_recurring.transaction_amount,
      currency: raw.auto_recurring.currency_id,
      frequency: raw.auto_recurring.frequency,
      frequencyType: raw.auto_recurring.frequency_type,
    },
    payer: {
      email: raw.payer_email,
      id: raw.payer_id,
    },
    dates: {
      created: new Date(raw.date_created),
      nextPayment: raw.next_payment_date
        ? new Date(raw.next_payment_date)
        : null,
      startDate: new Date(raw.auto_recurring.start_date),
      endDate: raw.auto_recurring.end_date
        ? new Date(raw.auto_recurring.end_date)
        : null,
    },
    billing: {
      chargedQuantity: raw.summarized.charged_quantity,
      chargedAmount: raw.summarized.charged_amount,
      pendingAmount: raw.summarized.pending_charge_amount,
    },
    paymentMethod: raw.payment_method_id,
    externalReference: raw.external_reference,
  };
}

/**
 * Fetch subscription details by preapproval_id
 */
async function fetchSubscriptionDetails(
  preapprovalId: string
): Promise<SubscriptionDetails> {
  const response = await fetch(
    `${API_URL}/api/payments/mercado-pago/subscriptions/${preapprovalId}`,
    {
      credentials: "include",
    }
  );

  if (!response.ok) {
    if (response.status === HTTP_NOT_FOUND) {
      throw new Error("SUBSCRIPTION_NOT_FOUND");
    }
    if (response.status === HTTP_FORBIDDEN) {
      throw new Error("SUBSCRIPTION_ACCESS_DENIED");
    }
    throw new Error("SUBSCRIPTION_FETCH_ERROR");
  }

  const data: MPSubscriptionResponse = await response.json();
  return transformSubscription(data);
}

/**
 * Hook to fetch and cache subscription details
 *
 * @param preapprovalId - The Mercado Pago preapproval_id from the URL
 * @returns Query result with subscription details
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useSubscriptionDetails(preapprovalId)
 *
 * if (isLoading) return <Skeleton />
 * if (error) return <ErrorMessage error={error} />
 * return <SubscriptionCard data={data} />
 * ```
 */
export function useSubscriptionDetails(preapprovalId: string | null) {
  return useQuery({
    queryKey: ["subscription-details", preapprovalId],
    queryFn: () => {
      if (!preapprovalId) {
        throw new Error("SUBSCRIPTION_ID_REQUIRED");
      }
      return fetchSubscriptionDetails(preapprovalId);
    },
    enabled: !!preapprovalId,
    staleTime: STALE_TIME_MS,
    retry: (failureCount, error) => {
      // Don't retry on known errors
      if (
        error instanceof Error &&
        ["SUBSCRIPTION_NOT_FOUND", "SUBSCRIPTION_ACCESS_DENIED"].includes(
          error.message
        )
      ) {
        return false;
      }
      return failureCount < MAX_RETRY_COUNT;
    },
  });
}

/**
 * Get a human-readable status label
 */
export function getStatusLabel(status: SubscriptionDetails["status"]): {
  label: string;
  variant: "success" | "warning" | "error" | "info";
} {
  const statusMap = {
    active: { label: "Activa", variant: "success" as const },
    authorized: { label: "Autorizada", variant: "success" as const },
    pending: { label: "Pendiente", variant: "warning" as const },
    paused: { label: "Pausada", variant: "info" as const },
    cancelled: { label: "Cancelada", variant: "error" as const },
  };
  return statusMap[status] || { label: status, variant: "info" as const };
}

/**
 * Format frequency for display
 */
export function formatFrequency(
  frequency: number,
  frequencyType: "days" | "months"
): string {
  if (frequencyType === "months") {
    if (frequency === 1) {
      return "mensual";
    }
    if (frequency === MONTHS_PER_YEAR) {
      return "anual";
    }
    return `cada ${frequency} meses`;
  }
  if (frequency === 1) {
    return "diario";
  }
  if (frequency === DAYS_PER_WEEK) {
    return "semanal";
  }
  return `cada ${frequency} días`;
}

/**
 * Format currency amount
 */
export function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}
