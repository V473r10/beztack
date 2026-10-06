import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { requestJson } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { SyncedPlanView } from "./types";

export function useSyncStatusQuery() {
  return useQuery({
    queryKey: queryKeys.admin.plansSync(),
    queryFn: async () => {
      return requestJson<{ plans: SyncedPlanView[]; provider: string }>(
        "/api/admin/plans/sync-status",
      );
    },
  });
}

export function useSyncMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      planId,
      direction,
    }: {
      planId: string;
      direction: "push-to-provider" | "pull-from-provider";
    }) => {
      return requestJson(`/api/admin/plans/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, direction }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.plansSync() });
      toast.success("Plan synced successfully");
    },
    onError: () => {
      toast.error("Failed to sync plan");
    },
  });
}

export function useImportMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      remoteProductId,
      canonicalTierId,
      displayOrder,
    }: {
      remoteProductId: string;
      canonicalTierId?: string;
      displayOrder?: number;
    }) => {
      return requestJson(`/api/admin/plans/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          remoteProductId,
          canonicalTierId,
          displayOrder,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.plansSync() });
      toast.success("Plan imported successfully");
    },
    onError: () => {
      toast.error("Failed to import plan");
    },
  });
}

export function useCreatePlanMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return requestJson(`/api/admin/plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.plansSync() });
      toast.success("Plan created successfully");
    },
    onError: () => {
      toast.error("Failed to create plan");
    },
  });
}

export function useDeletePlanMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (planId: string) => {
      return requestJson(`/api/admin/plans/${planId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.plansSync() });
      toast.success("Plan deleted successfully");
    },
    onError: () => {
      toast.error("Failed to delete plan");
    },
  });
}

export function useUpdatePlanMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ planId, data }: { planId: string; data: Record<string, unknown> }) => {
      return requestJson(`/api/admin/plans/${planId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.plansSync() });
      toast.success("Plan updated successfully");
    },
    onError: () => {
      toast.error("Failed to update plan");
    },
  });
}
