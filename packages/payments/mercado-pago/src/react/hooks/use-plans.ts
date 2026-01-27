import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreatePlanData,
  CreatePlanResponse,
  Plan,
  PlansResponse,
  SyncPlansResponse,
} from "../../types.js";
import { useMercadoPagoContext } from "../provider.js";

// ============================================================================
// Query Keys
// ============================================================================

/**
 * Query keys for plans cache management
 *
 * @example
 * ```typescript
 * // Invalidate all plans
 * queryClient.invalidateQueries({ queryKey: plansKeys.all })
 *
 * // Invalidate specific plan
 * queryClient.invalidateQueries({ queryKey: plansKeys.detail("plan_123") })
 * ```
 */
export const plansKeys = {
  all: ["mp-plans"] as const,
  list: (status?: string) => [...plansKeys.all, status] as const,
  detail: (id: string) => [...plansKeys.all, "detail", id] as const,
};

// ============================================================================
// Hooks
// ============================================================================

/**
 * Fetch subscription plans
 *
 * @param options - Filter and control options
 * @param options.status - Filter by plan status ("active" | "inactive")
 * @param options.enabled - Enable/disable the query (default: true)
 * @returns TanStack Query result with plans data
 *
 * @example
 * ```tsx
 * function PlansList() {
 *   const { data, isLoading, error } = usePlans({ status: "active" })
 *
 *   if (isLoading) return <Spinner />
 *   if (error) return <Error message={error.message} />
 *
 *   return (
 *     <ul>
 *       {data?.plans.map(plan => (
 *         <li key={plan.id}>{plan.reason} - {plan.transactionAmount}</li>
 *       ))}
 *     </ul>
 *   )
 * }
 * ```
 */
export function usePlans(options?: { status?: string; enabled?: boolean }) {
  const { endpoints } = useMercadoPagoContext();
  const { status, enabled = true } = options ?? {};

  return useQuery({
    queryKey: plansKeys.list(status),
    queryFn: async (): Promise<PlansResponse> => {
      const params = new URLSearchParams();
      if (status) {
        params.append("status", status);
      }

      const url = params.toString()
        ? `${endpoints.plans}?${params.toString()}`
        : endpoints.plans;

      const response = await fetch(url);

      if (!response.ok) {
        const error = (await response.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(error.message ?? "Failed to fetch plans");
      }

      return response.json();
    },
    enabled,
  });
}

/**
 * Fetch a single plan by ID
 *
 * @param planId - The plan ID to fetch (query disabled if undefined)
 * @returns TanStack Query result with plan data
 *
 * @example
 * ```tsx
 * function PlanDetail({ planId }: { planId: string }) {
 *   const { data: plan, isLoading } = usePlan(planId)
 *
 *   if (isLoading) return <Spinner />
 *
 *   return (
 *     <div>
 *       <h2>{plan?.reason}</h2>
 *       <p>{plan?.transactionAmount} {plan?.currencyId}</p>
 *     </div>
 *   )
 * }
 * ```
 */
export function usePlan(planId: string | undefined) {
  const { endpoints } = useMercadoPagoContext();

  return useQuery({
    queryKey: plansKeys.detail(planId ?? ""),
    queryFn: async (): Promise<Plan> => {
      const response = await fetch(`${endpoints.plans}/${planId}`);

      if (!response.ok) {
        const error = (await response.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(error.message ?? "Failed to fetch plan");
      }

      return response.json();
    },
    enabled: !!planId,
  });
}

/**
 * Create a new subscription plan
 *
 * @param options - Mutation callbacks
 * @param options.onSuccess - Called when plan is created successfully
 * @param options.onError - Called when creation fails
 * @returns TanStack Mutation with mutate function
 *
 * @example
 * ```tsx
 * function CreatePlanForm() {
 *   const { mutate, isPending } = useCreatePlan({
 *     onSuccess: (plan) => toast.success(`Plan ${plan.reason} created!`),
 *     onError: (error) => toast.error(error.message),
 *   })
 *
 *   const handleSubmit = (data: CreatePlanData) => {
 *     mutate(data)
 *   }
 *
 *   return <form onSubmit={handleSubmit}>...</form>
 * }
 * ```
 */
export function useCreatePlan(options?: {
  onSuccess?: (data: CreatePlanResponse) => void;
  onError?: (error: Error) => void;
}) {
  const { endpoints } = useMercadoPagoContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreatePlanData): Promise<CreatePlanResponse> => {
      const response = await fetch(endpoints.plans, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = (await response.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(error.message ?? "Failed to create plan");
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: plansKeys.all });
      options?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      options?.onError?.(error);
    },
  });
}

export function useSyncPlans(options?: {
  onSuccess?: (data: SyncPlansResponse) => void;
  onError?: (error: Error) => void;
}) {
  const { endpoints } = useMercadoPagoContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<SyncPlansResponse> => {
      const response = await fetch(`${endpoints.plans}/sync`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = (await response.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(error.message ?? "Failed to sync plans");
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: plansKeys.all });
      options?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      options?.onError?.(error);
    },
  });
}

export function useRefreshPlans(options?: {
  onSuccess?: (data: PlansResponse) => void;
  onError?: (error: Error) => void;
}) {
  const { endpoints } = useMercadoPagoContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<PlansResponse> => {
      const response = await fetch(`${endpoints.plans}?refresh=true`);

      if (!response.ok) {
        const error = (await response.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(error.message ?? "Failed to refresh plans");
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: plansKeys.all });
      options?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      options?.onError?.(error);
    },
  });
}
