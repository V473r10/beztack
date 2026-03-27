import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { API_URL, QUERY_KEY } from "./constants";
import type { SyncedPlanView } from "./types";

export function useSyncStatusQuery() {
  return useQuery<{ plans: SyncedPlanView[]; provider: string }>({
    queryKey: [...QUERY_KEY],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/admin/plans/sync-status`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to fetch sync status");
      }
      return res.json();
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
      const res = await fetch(`${API_URL}/api/admin/plans/sync`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, direction }),
      });
      if (!res.ok) {
        throw new Error("Sync failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY] });
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
      const res = await fetch(`${API_URL}/api/admin/plans/import`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          remoteProductId,
          canonicalTierId,
          displayOrder,
        }),
      });
      if (!res.ok) {
        throw new Error("Import failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY] });
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
      const res = await fetch(`${API_URL}/api/admin/plans`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        throw new Error("Create failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY] });
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
      const res = await fetch(`${API_URL}/api/admin/plans/${planId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Delete failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY] });
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
    mutationFn: async ({
      planId,
      data,
    }: {
      planId: string;
      data: Record<string, unknown>;
    }) => {
      const res = await fetch(`${API_URL}/api/admin/plans/${planId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        throw new Error("Update failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY] });
      toast.success("Plan updated successfully");
    },
    onError: () => {
      toast.error("Failed to update plan");
    },
  });
}
