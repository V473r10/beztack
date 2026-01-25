import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { env } from "@/env";
import type {
  CreatePlanData,
  CreatePlanResponse,
  Plan,
  PlansResponse,
  SyncPlansResponse,
} from "@/lib/mercado-pago-types";

const PLANS_BASE_URL = `${env.VITE_API_URL}/api/payments/mercado-pago/subscriptions/plans`;

// ============================================================================
// Query: Fetch plans
// ============================================================================

export function usePlans(options?: { status?: string; enabled?: boolean }) {
  const { status, enabled = true } = options ?? {};

  return useQuery({
    queryKey: ["mp-plans", status],
    queryFn: async (): Promise<PlansResponse> => {
      const params = new URLSearchParams();
      if (status) {
        params.append("status", status);
      }

      const url = params.toString()
        ? `${PLANS_BASE_URL}?${params.toString()}`
        : PLANS_BASE_URL;

      const response = await fetch(url);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "Failed to fetch plans");
      }

      return response.json();
    },
    enabled,
  });
}

// ============================================================================
// Query: Fetch single plan
// ============================================================================

export function usePlan(planId: string | undefined) {
  return useQuery({
    queryKey: ["mp-plan", planId],
    queryFn: async (): Promise<Plan> => {
      const response = await fetch(`${PLANS_BASE_URL}/${planId}`);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "Failed to fetch plan");
      }

      return response.json();
    },
    enabled: !!planId,
  });
}

// ============================================================================
// Mutation: Create plan
// ============================================================================

export function useCreatePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreatePlanData): Promise<CreatePlanResponse> => {
      const response = await fetch(PLANS_BASE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "Failed to create plan");
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["mp-plans"] });
      toast.success(`Plan "${data.reason}" creado exitosamente`);
    },
    onError: (error: Error) => {
      toast.error(`Error al crear plan: ${error.message}`);
    },
  });
}

// ============================================================================
// Mutation: Sync plans from Mercado Pago
// ============================================================================

export function useSyncPlans() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<SyncPlansResponse> => {
      const response = await fetch(`${PLANS_BASE_URL}/sync`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "Failed to sync plans");
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["mp-plans"] });
      const { stats } = data;
      toast.success(
        `Sincronización completada: ${stats.created} creados, ${stats.updated} actualizados`
      );
    },
    onError: (error: Error) => {
      toast.error(`Error al sincronizar: ${error.message}`);
    },
  });
}

// ============================================================================
// Mutation: Refresh plans (force fetch from MP)
// ============================================================================

export function useRefreshPlans() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<PlansResponse> => {
      const response = await fetch(`${PLANS_BASE_URL}?refresh=true`);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "Failed to refresh plans");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mp-plans"] });
      toast.success("Planes actualizados desde Mercado Pago");
    },
    onError: (error: Error) => {
      toast.error(`Error al actualizar: ${error.message}`);
    },
  });
}
