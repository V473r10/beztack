import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requestJson } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

/** One row of `GET /api/auth/admin/plan-changes/failed`. Dates are ISO strings. */
export type FailedPlanChange = {
  id: string;
  subscriptionId: string;
  direction: "downgrade" | "cadence_change";
  membershipTarget: { type: "user" | "organization"; id: string };
  /** The user's email or the organization's name; null if it was deleted. */
  membershipTargetName: string | null;
  acceptedByEmail: string | null;
  /** The last activation error. */
  reason: string | null;
  activationAttempts: number;
  effectiveAt: string | null;
  createdAt: string;
  failedAt: string | null;
  targetPlanSnapshot: {
    canonicalTierId: string;
    billingCadence: string;
    paymentProvider: string;
    price: { amount: number; currency: string };
  };
};

type FailedPlanChangesResponse = { failedPlanChanges: FailedPlanChange[]; total: number };

/** Pending Plan changes whose activation kept failing. App admins only. */
export function useFailedPlanChanges() {
  return useQuery({
    queryKey: queryKeys.admin.failedPlanChanges(),
    queryFn: async () =>
      (await requestJson<FailedPlanChangesResponse>("/api/auth/admin/plan-changes/failed"))
        .failedPlanChanges,
  });
}

/** What `POST /api/auth/admin/plan-changes/:id/retry` returns. */
export type PlanChangeRetryResult = {
  action: "activated" | "failed" | "canceled" | "skipped";
  pendingPlanChange: { id: string; reason: string | null } | null;
};

/** Activates a failed change now; refreshes the list whatever the outcome. */
export function useRetryFailedPlanChange() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (pendingPlanChangeId: string) =>
      requestJson<PlanChangeRetryResult>(
        `/api/auth/admin/plan-changes/${encodeURIComponent(pendingPlanChangeId)}/retry`,
        { method: "POST" },
      ),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.failedPlanChanges() }),
  });
}
