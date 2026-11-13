/**
 * Hook for fetching subscription details from Mercado Pago
 * Used primarily for the subscription welcome page after checkout redirect
 */
import { useQuery } from "@tanstack/react-query";
import { ApiError, requestJson } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

// Time constants
const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;
const STALE_TIME_MINUTES = 5;
const STALE_TIME_MS = STALE_TIME_MINUTES * SECONDS_PER_MINUTE * MS_PER_SECOND;

// Retry constants
const MAX_RETRY_COUNT = 2;

// HTTP status codes
const HTTP_NOT_FOUND = 404;
const HTTP_FORBIDDEN = 403;

const MONTHS_PER_YEAR = 12;
const DAYS_PER_WEEK = 7;

type ApiSubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "unpaid"
  | "pending"
  | "inactive"
  | "canceled"
  | "paused";

/**
 * The Subscription `GET /api/subscriptions/:id` answers, as JSON (dates are
 * strings). The charged amount is an integer in minor units (ADR 0007) and
 * travels in `metadata` with its currency and interval.
 */
type ApiSubscriptionResponse = {
  provider: string;
  subscription: {
    id: string;
    status: ApiSubscriptionStatus;
    productName?: string;
    currentPeriodEnd?: string;
    metadata?: {
      billingAmount?: number;
      billingCurrency?: string;
      billingInterval?: "month" | "year" | "day" | "week";
      billingFrequency?: number;
      paymentMethodId?: string;
    };
  };
};

/**
 * Subscription data for the Mercado Pago return page
 */
export type SubscriptionDetails = {
  id: string;
  status: ApiSubscriptionStatus;
  plan: {
    name: string | null;
  };
  /** `null` when the provider reported no charged amount. `amount` is in minor units. */
  price: {
    amount: number;
    currency: string;
    frequency: number;
    frequencyType: "days" | "months";
  } | null;
  dates: {
    nextPayment: Date | null;
  };
  paymentMethod: string | null;
};

function readPrice(
  metadata: ApiSubscriptionResponse["subscription"]["metadata"],
): SubscriptionDetails["price"] {
  const { billingAmount, billingCurrency, billingInterval, billingFrequency } = metadata ?? {};
  if (typeof billingAmount !== "number" || !billingCurrency) {
    return null;
  }
  const count = billingFrequency ?? 1;
  switch (billingInterval) {
    case "day":
      return {
        amount: billingAmount,
        currency: billingCurrency,
        frequency: count,
        frequencyType: "days",
      };
    case "week":
      return {
        amount: billingAmount,
        currency: billingCurrency,
        frequency: count * DAYS_PER_WEEK,
        frequencyType: "days",
      };
    case "year":
      return {
        amount: billingAmount,
        currency: billingCurrency,
        frequency: count * MONTHS_PER_YEAR,
        frequencyType: "months",
      };
    default:
      return {
        amount: billingAmount,
        currency: billingCurrency,
        frequency: count,
        frequencyType: "months",
      };
  }
}

function transformSubscription({ subscription }: ApiSubscriptionResponse): SubscriptionDetails {
  return {
    id: subscription.id,
    status: subscription.status,
    plan: { name: subscription.productName ?? null },
    price: readPrice(subscription.metadata),
    dates: {
      nextPayment: subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : null,
    },
    paymentMethod: subscription.metadata?.paymentMethodId ?? null,
  };
}

/**
 * Fetch subscription details by preapproval_id
 */
async function fetchSubscriptionDetails(preapprovalId: string): Promise<SubscriptionDetails> {
  let data: ApiSubscriptionResponse;
  try {
    data = await requestJson<ApiSubscriptionResponse>(
      `/api/subscriptions/${encodeURIComponent(preapprovalId)}`,
    );
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === HTTP_NOT_FOUND) {
      throw new Error("SUBSCRIPTION_NOT_FOUND");
    }
    if (error instanceof ApiError && error.statusCode === HTTP_FORBIDDEN) {
      throw new Error("SUBSCRIPTION_ACCESS_DENIED");
    }
    throw new Error("SUBSCRIPTION_FETCH_ERROR");
  }

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
    queryKey: queryKeys.subscriptions.details(preapprovalId),
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
        ["SUBSCRIPTION_NOT_FOUND", "SUBSCRIPTION_ACCESS_DENIED"].includes(error.message)
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
export function getStatusLabel(status: string): {
  label: string;
  variant: "success" | "warning" | "error" | "info";
} {
  const statusMap: Record<
    string,
    { label: string; variant: "success" | "warning" | "error" | "info" }
  > = {
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
export function formatFrequency(frequency: number, frequencyType: "days" | "months"): string {
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
