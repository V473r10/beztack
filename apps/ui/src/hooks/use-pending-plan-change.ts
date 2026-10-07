import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requestJson } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

/** What `GET /api/subscriptions/plan-change/pending` returns. */
export type PendingPlanChange = {
  id: string;
  direction: "downgrade" | "cadence_change";
  /** ISO date the change applies at, or null when the provider gave none. */
  effectiveAt: string | null;
  subscriptionId: string;
  targetPlan: {
    id: string;
    tierId: string;
    billingCadence: "monthly" | "yearly";
    price: { amount: number; currency: string };
  };
};

type PendingPlanChangeResponse = { pendingPlanChange: PendingPlanChange | null };

function organizationQueryString(organizationId: string | undefined): string {
  return organizationId ? `?${new URLSearchParams({ organizationId }).toString()}` : "";
}

/** The Membership target's Pending Plan change. Only for Billing managers. */
export function usePendingPlanChange(organizationId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.subscriptions.pendingPlanChange(organizationId),
    queryFn: async () =>
      (
        await requestJson<PendingPlanChangeResponse>(
          `/api/subscriptions/plan-change/pending${organizationQueryString(organizationId)}`,
        )
      ).pendingPlanChange,
    enabled,
  });
}

/** Cancels it, keeping the Current Subscription terms. */
export function useCancelPendingPlanChange(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      requestJson("/api/subscriptions/plan-change/pending", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(organizationId ? { organizationId } : {}),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.subscriptions.pendingPlanChange(organizationId),
      }),
  });
}
