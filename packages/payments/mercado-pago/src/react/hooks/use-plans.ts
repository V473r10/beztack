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

export const plansKeys = {
  all: ["mp-plans"] as const,
  list: (status?: string) => [...plansKeys.all, status] as const,
  detail: (id: string) => [...plansKeys.all, "detail", id] as const,
};

// ============================================================================
// Hooks
// ============================================================================

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
