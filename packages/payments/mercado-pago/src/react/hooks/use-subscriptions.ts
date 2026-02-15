import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMercadoPagoContext } from "../provider.js";

// ============================================================================
// Types
// ============================================================================

export type SubscriptionResponse = {
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
  chargedQuantity?: number | null;
  chargedAmount?: number | string | null;
};

export type SubscriptionsSearchResponse = {
  subscriptions: SubscriptionResponse[];
  total: number;
};

export type InvoiceResponse = {
  id: string;
  subscriptionId?: string | null;
  paymentId?: string | null;
  status: string;
  reason?: string | null;
  transactionAmount?: number | string | null;
  currencyId?: string | null;
  debitDate?: string | null;
  dateCreated?: string | null;
  retryAttempt?: number | null;
};

export type InvoicesResponse = {
  invoices: InvoiceResponse[];
  total: number;
};

// ============================================================================
// Query Keys
// ============================================================================

export const subscriptionsKeys = {
  all: ["mp-subscriptions"] as const,
  lists: () => [...subscriptionsKeys.all, "list"] as const,
  list: (filters: Record<string, unknown>) =>
    [...subscriptionsKeys.lists(), filters] as const,
  details: () => [...subscriptionsKeys.all, "detail"] as const,
  detail: (id: string) => [...subscriptionsKeys.details(), id] as const,
  invoices: (id: string) =>
    [...subscriptionsKeys.detail(id), "invoices"] as const,
};

// ============================================================================
// Hooks
// ============================================================================

export type UseSubscriptionsOptions = {
  status?: string;
  limit?: number;
  offset?: number;
  enabled?: boolean;
};

/**
 * Fetch user subscriptions
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useSubscriptions({ status: "active" })
 * ```
 */
export function useSubscriptions(options: UseSubscriptionsOptions = {}) {
  const { endpoints } = useMercadoPagoContext();
  const { status, limit, offset, enabled = true } = options;

  return useQuery({
    queryKey: subscriptionsKeys.list({ status, limit, offset }),
    queryFn: async (): Promise<SubscriptionsSearchResponse> => {
      const params = new URLSearchParams();
      if (status) {
        params.set("status", status);
      }
      if (limit) {
        params.set("limit", String(limit));
      }
      if (offset) {
        params.set("offset", String(offset));
      }

      const query = params.toString();
      const url = query
        ? `${endpoints.subscriptions}/search?${query}`
        : `${endpoints.subscriptions}/search`;

      const response = await fetch(url, { credentials: "include" });

      if (!response.ok) {
        throw new Error("Failed to fetch subscriptions");
      }

      return response.json();
    },
    enabled,
  });
}

/**
 * Fetch a single subscription by ID
 *
 * @example
 * ```tsx
 * const { data } = useSubscription("sub_123")
 * ```
 */
export function useSubscription(subscriptionId: string | undefined) {
  const { endpoints } = useMercadoPagoContext();

  return useQuery({
    queryKey: subscriptionsKeys.detail(subscriptionId || ""),
    queryFn: async (): Promise<SubscriptionResponse> => {
      const response = await fetch(
        `${endpoints.subscriptions}/${subscriptionId}`,
        { credentials: "include" }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch subscription");
      }

      return response.json();
    },
    enabled: !!subscriptionId,
  });
}

/**
 * Fetch invoices for a subscription
 *
 * @example
 * ```tsx
 * const { data } = useSubscriptionInvoices("sub_123")
 * ```
 */
export function useSubscriptionInvoices(
  subscriptionId: string | undefined,
  options: { status?: string; limit?: number; enabled?: boolean } = {}
) {
  const { endpoints } = useMercadoPagoContext();
  const { status, limit, enabled = true } = options;

  return useQuery({
    queryKey: subscriptionsKeys.invoices(subscriptionId || ""),
    queryFn: async (): Promise<InvoicesResponse> => {
      const params = new URLSearchParams();
      if (status) {
        params.set("status", status);
      }
      if (limit) {
        params.set("limit", String(limit));
      }

      const query = params.toString();
      const url = query
        ? `${endpoints.subscriptions}/${subscriptionId}/invoices?${query}`
        : `${endpoints.subscriptions}/${subscriptionId}/invoices`;

      const response = await fetch(url, { credentials: "include" });

      if (!response.ok) {
        throw new Error("Failed to fetch invoices");
      }

      return response.json();
    },
    enabled: !!subscriptionId && enabled,
  });
}

/**
 * Pause a subscription
 */
export function usePauseSubscription() {
  const { endpoints } = useMercadoPagoContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (subscriptionId: string) => {
      const response = await fetch(
        `${endpoints.subscriptions}/${subscriptionId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ status: "paused" }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to pause subscription");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionsKeys.all });
    },
  });
}

/**
 * Resume a paused subscription
 */
export function useResumeSubscription() {
  const { endpoints } = useMercadoPagoContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (subscriptionId: string) => {
      const response = await fetch(
        `${endpoints.subscriptions}/${subscriptionId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ status: "authorized" }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to resume subscription");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionsKeys.all });
    },
  });
}

/**
 * Cancel a subscription
 */
export function useCancelSubscription() {
  const { endpoints } = useMercadoPagoContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (subscriptionId: string) => {
      const response = await fetch(
        `${endpoints.subscriptions}/${subscriptionId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ status: "cancelled" }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to cancel subscription");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionsKeys.all });
    },
  });
}
