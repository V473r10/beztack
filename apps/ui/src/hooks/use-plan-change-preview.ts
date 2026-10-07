import { useQuery } from "@tanstack/react-query";
import { requestJson } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

type PreviewPlan = {
  id: string;
  canonicalTierId: string;
  billingCadence: "monthly" | "yearly";
  price: {
    amount: number;
    currency: string;
  };
};

/**
 * The server's Plan change preview (`POST /api/subscriptions/plan-change/preview`).
 * It is the authority on what a Plan change costs: the UI renders these
 * numbers as they come and never recomputes them.
 */
export type PlanChangePreview = {
  direction: "upgrade" | "downgrade" | "cadence_change";
  currentPlan: PreviewPlan;
  targetPlan: PreviewPlan;
  /** ISO date; when a Downgrade or Cadence change takes effect. */
  effectiveAt: string | null;
  effectiveTiming: "after_first_payment" | "next_renewal";
  currentPeriod: {
    daysRemaining: number;
    totalDays: number;
  } | null;
  firstPayment: {
    amount: number;
    /** Upgrade credit for the unused current period, from what was charged. */
    credit: number;
    currency: string;
    fullAmount: number;
  };
};

type PlanChangePreviewResponse = {
  planChangePreview: PlanChangePreview;
};

export function usePlanChangePreview(input: {
  subscriptionId?: string;
  targetTierId?: string;
  billingPeriod: "monthly" | "yearly";
  enabled: boolean;
}) {
  return useQuery<PlanChangePreview>({
    queryKey: queryKeys.subscriptions.planChangePreview(
      input.subscriptionId,
      input.targetTierId,
      input.billingPeriod,
    ),
    queryFn: async () => {
      const response = await requestJson<PlanChangePreviewResponse>(
        "/api/subscriptions/plan-change/preview",
        {
          body: JSON.stringify({
            targetBillingCadence: input.billingPeriod,
            targetTierId: input.targetTierId,
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      );
      return response.planChangePreview;
    },
    enabled: input.enabled && Boolean(input.subscriptionId && input.targetTierId),
    // A preview is a quote: a failed one is shown, not silently retried.
    retry: false,
    staleTime: 30_000,
  });
}
