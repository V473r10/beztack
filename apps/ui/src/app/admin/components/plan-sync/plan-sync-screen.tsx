import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  CheckCircle2,
  Cloud,
  CreditCard,
  Database,
  Edit2,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Save,
  ServerCrash,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { env } from "@/env";
import { cn } from "@/lib/utils";

const API_URL = env.VITE_API_URL;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SyncStatus = "synced" | "local-only" | "remote-only" | "out-of-sync";

type SyncDiff = {
  field: string;
  localValue: unknown;
  remoteValue: unknown;
};

type Product = {
  id: string;
  name: string;
  description?: string;
  type: string;
  price: { amount: number; currency: string };
  interval: string;
  intervalCount: number;
  metadata?: Record<string, unknown>;
};

type DbPlan = {
  id: string;
  provider: string;
  providerPlanId: string | null;
  canonicalTierId: string;
  displayName: string;
  description: string | null;
  features: string[] | null;
  limits: Record<string, number> | null;
  permissions: string[] | null;
  price: string;
  currency: string;
  interval: string | null;
  intervalCount: number | null;
  displayOrder: number | null;
  highlighted: boolean | null;
  visible: boolean | null;
  status: string | null;
  createdAt: string;
  updatedAt: string;
};

type SyncedPlanView = {
  localPlan: DbPlan | null;
  remoteProduct: Product | null;
  syncStatus: SyncStatus;
  diffs: SyncDiff[];
};

type EditState = {
  canonicalTierId: string | null;
  displayName: string;
  description: string;
  features: string;
  limits: string;
  permissions: string;
  displayOrder: number | null;
  highlighted: boolean;
  visible: boolean;
};

type CreatePlanState = {
  displayName: string;
  description: string;
  canonicalTierId: string;
  price: string;
  currency: string;
  interval: string;
  intervalCount: string;
  features: string;
  limits: string;
  permissions: string;
  displayOrder: string;
  highlighted: boolean;
  visible: boolean;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIER_OPTIONS = [
  { value: "free", label: "Free" },
  { value: "basic", label: "Basic" },
  { value: "pro", label: "Pro" },
  { value: "ultimate", label: "Ultimate" },
  { value: "custom", label: "Custom" },
];

const INTERVAL_OPTIONS = [
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
];

const MAX_FEATURES_DISPLAY = 4;
const QUERY_KEY = ["admin-plans-sync"] as const;
// biome-ignore lint/style/noMagicNumbers: Skeleton items array
const SKELETON_ITEMS = [1, 2, 3, 4] as const;

const INITIAL_CREATE_STATE: CreatePlanState = {
  displayName: "",
  description: "",
  canonicalTierId: "basic",
  price: "",
  currency: "USD",
  interval: "month",
  intervalCount: "1",
  features: "",
  limits: "{}",
  permissions: "",
  displayOrder: "",
  highlighted: false,
  visible: true,
};

// ---------------------------------------------------------------------------
// Query Hooks
// ---------------------------------------------------------------------------

function useSyncStatusQuery() {
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

function useSyncMutation() {
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

function useImportMutation() {
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

function useCreatePlanMutation() {
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

function useDeletePlanMutation() {
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

function useUpdatePlanMutation() {
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function planToEditState(plan: DbPlan): EditState {
  return {
    canonicalTierId: plan.canonicalTierId,
    displayName: plan.displayName,
    description: plan.description ?? "",
    features: (plan.features ?? []).join("\n"),
    limits: plan.limits ? JSON.stringify(plan.limits, null, 2) : "{}",
    permissions: (plan.permissions ?? []).join("\n"),
    displayOrder: plan.displayOrder,
    highlighted: plan.highlighted ?? false,
    visible: plan.visible ?? true,
  };
}

function formatPrice(amount: number | string, currency: string): string {
  const num = typeof amount === "string" ? Number.parseFloat(amount) : amount;
  return `${num.toFixed(2)} ${currency}`;
}

function getPlanDisplayName(view: SyncedPlanView): string {
  if (view.localPlan) {
    return view.localPlan.displayName;
  }
  if (view.remoteProduct) {
    return view.remoteProduct.name;
  }
  return "Unknown Plan";
}

function getPlanKey(view: SyncedPlanView): string {
  if (view.localPlan) {
    return view.localPlan.id;
  }
  if (view.remoteProduct) {
    return `remote-${view.remoteProduct.id}`;
  }
  return `unknown-${Math.random()}`;
}

// ---------------------------------------------------------------------------
// Sync Status Badge
// ---------------------------------------------------------------------------

function SyncStatusBadge({ status }: { status: SyncStatus }) {
  // biome-ignore lint/nursery/noUnnecessaryConditions: Exhaustive switch for type safety
  switch (status) {
    case "synced":
      return (
        <Badge className="gap-1 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-400">
          <Check className="h-3 w-3" />
          Synced
        </Badge>
      );
    case "local-only":
      return (
        <Badge className="gap-1 bg-blue-500/15 text-blue-700 hover:bg-blue-500/25 dark:bg-blue-500/10 dark:text-blue-400">
          <Database className="h-3 w-3" />
          Local Only
        </Badge>
      );
    case "remote-only":
      return (
        <Badge className="gap-1 bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 dark:bg-amber-500/10 dark:text-amber-400">
          <Cloud className="h-3 w-3" />
          Remote Only
        </Badge>
      );
    case "out-of-sync":
      return (
        <Badge className="gap-1 bg-red-500/15 text-red-700 hover:bg-red-500/25 dark:bg-red-500/10 dark:text-red-400">
          <AlertTriangle className="h-3 w-3" />
          Out of Sync
        </Badge>
      );
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Diff Table
// ---------------------------------------------------------------------------

function DiffTable({ diffs, planId }: { diffs: SyncDiff[]; planId: string }) {
  const syncMutation = useSyncMutation();

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2 text-left font-medium">Field</th>
              <th className="px-3 py-2 text-left font-medium">Local Value</th>
              <th className="px-3 py-2 text-left font-medium">Remote Value</th>
            </tr>
          </thead>
          <tbody>
            {diffs.map((diff) => (
              <tr className="border-b last:border-0" key={diff.field}>
                <td className="px-3 py-2 font-mono text-xs">{diff.field}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {String(diff.localValue ?? "—")}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {String(diff.remoteValue ?? "—")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2">
        <Button
          className="gap-1.5"
          disabled={syncMutation.isPending}
          onClick={() =>
            syncMutation.mutate({
              planId,
              direction: "push-to-provider",
            })
          }
          size="sm"
          type="button"
          variant="outline"
        >
          {syncMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ArrowUpFromLine className="h-3.5 w-3.5" />
          )}
          Keep Local
        </Button>
        <Button
          className="gap-1.5"
          disabled={syncMutation.isPending}
          onClick={() =>
            syncMutation.mutate({
              planId,
              direction: "pull-from-provider",
            })
          }
          size="sm"
          type="button"
          variant="outline"
        >
          {syncMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ArrowDownToLine className="h-3.5 w-3.5" />
          )}
          Keep Remote
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plan Edit Card (for synced & local-only plans)
// ---------------------------------------------------------------------------

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Edit card has many fields
function PlanEditCard({
  plan,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onDelete,
}: {
  plan: DbPlan;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
}) {
  const [editState, setEditState] = useState<EditState>(planToEditState(plan));
  const updateMutation = useUpdatePlanMutation();

  const handleSave = () => {
    const data: Record<string, unknown> = {
      canonicalTierId: editState.canonicalTierId,
      displayName: editState.displayName,
      description: editState.description || null,
      features: editState.features
        .split("\n")
        .map((f) => f.trim())
        .filter(Boolean),
      permissions: editState.permissions
        .split("\n")
        .map((p) => p.trim())
        .filter(Boolean),
      displayOrder: editState.displayOrder,
      highlighted: editState.highlighted,
      visible: editState.visible,
    };

    try {
      data.limits = JSON.parse(editState.limits);
    } catch {
      toast.error("Invalid JSON in limits field");
      return;
    }

    updateMutation.mutate(
      { planId: plan.id, data },
      { onSuccess: () => onCancelEdit() }
    );
  };

  if (isEditing) {
    return (
      <Card className="border-primary/50 shadow-md ring-1 ring-primary/20">
        <CardHeader className="border-b bg-muted/30 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">
                Edit Plan: {plan.displayName}
              </CardTitle>
              <CardDescription className="mt-1.5 font-mono text-xs">
                {plan.id}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                className="gap-2"
                disabled={updateMutation.isPending}
                onClick={handleSave}
                size="sm"
                type="button"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Changes
              </Button>
              <Button
                onClick={() => {
                  setEditState(planToEditState(plan));
                  onCancelEdit();
                }}
                size="sm"
                type="button"
                variant="ghost"
              >
                Cancel
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-8 pt-6">
          <div className="space-y-4">
            <h4 className="flex items-center gap-2 font-medium text-foreground text-sm">
              <Package className="h-4 w-4 text-primary" />
              Basic Information
            </h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Display Name</Label>
                <Input
                  onChange={(e) =>
                    setEditState((s) => ({
                      ...s,
                      displayName: e.target.value,
                    }))
                  }
                  placeholder="e.g. Pro Plan (Monthly)"
                  value={editState.displayName}
                />
              </div>
              <div className="space-y-2">
                <Label>Canonical Tier</Label>
                <Select
                  onValueChange={(v) =>
                    setEditState((s) => ({
                      ...s,
                      canonicalTierId: v === "none" ? null : v,
                    }))
                  }
                  value={editState.canonicalTierId ?? "none"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select tier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (Custom/Hidden)</SelectItem>
                    {TIER_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                onChange={(e) =>
                  setEditState((s) => ({
                    ...s,
                    description: e.target.value,
                  }))
                }
                placeholder="Short description displayed under the plan name"
                value={editState.description}
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="flex items-center gap-2 font-medium text-foreground text-sm">
              <Activity className="h-4 w-4 text-primary" />
              Features & Permissions
            </h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="flex justify-between">
                  <span>Features</span>
                  <span className="font-normal text-muted-foreground text-xs">
                    One per line
                  </span>
                </Label>
                <Textarea
                  className="min-h-[120px] resize-y"
                  onChange={(e) =>
                    setEditState((s) => ({
                      ...s,
                      features: e.target.value,
                    }))
                  }
                  placeholder={
                    "Unlimited projects\nPriority support\nCustom domains"
                  }
                  value={editState.features}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex justify-between">
                  <span>Permissions</span>
                  <span className="font-normal text-muted-foreground text-xs">
                    One per line
                  </span>
                </Label>
                <Textarea
                  className="min-h-[120px] resize-y"
                  onChange={(e) =>
                    setEditState((s) => ({
                      ...s,
                      permissions: e.target.value,
                    }))
                  }
                  placeholder={"create:project\nmanage:billing"}
                  value={editState.permissions}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Limits (JSON)</Label>
              <Textarea
                className="min-h-[100px] font-mono text-xs"
                onChange={(e) =>
                  setEditState((s) => ({ ...s, limits: e.target.value }))
                }
                placeholder={'{\n  "maxProjects": 10,\n  "storageGB": 5\n}'}
                value={editState.limits}
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="flex items-center gap-2 font-medium text-foreground text-sm">
              <CreditCard className="h-4 w-4 text-primary" />
              Presentation Settings
            </h4>
            <div className="grid grid-cols-1 gap-6 rounded-lg border bg-muted/30 p-4 sm:grid-cols-3">
              <div className="space-y-3">
                <Label>Display Order</Label>
                <Input
                  onChange={(e) =>
                    setEditState((s) => ({
                      ...s,
                      displayOrder:
                        e.target.value === "" ? null : Number(e.target.value),
                    }))
                  }
                  placeholder="0, 1, 2..."
                  type="number"
                  value={editState.displayOrder ?? ""}
                />
              </div>
              <div className="flex flex-col justify-center space-y-3">
                <Label>Visibility</Label>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editState.visible}
                    onCheckedChange={(v) =>
                      setEditState((s) => ({ ...s, visible: v }))
                    }
                  />
                  <span className="text-muted-foreground text-sm">
                    {editState.visible ? "Visible to users" : "Hidden"}
                  </span>
                </div>
              </div>
              <div className="flex flex-col justify-center space-y-3">
                <Label>Highlight</Label>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editState.highlighted}
                    onCheckedChange={(v) =>
                      setEditState((s) => ({ ...s, highlighted: v }))
                    }
                  />
                  <span className="text-muted-foreground text-sm">
                    {editState.highlighted ? "Featured plan" : "Standard"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isActive = plan.status === "active";
  const isHighlighted = plan.highlighted;

  return (
    <Card
      className={cn(
        "flex flex-col overflow-hidden transition-all duration-200",
        isActive
          ? "border-border hover:border-primary/40 hover:shadow-md"
          : "border-dashed bg-muted/20 opacity-80",
        isHighlighted &&
          isActive &&
          "border-primary/50 shadow-sm ring-1 ring-primary/10"
      )}
    >
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="font-semibold text-xl leading-none">
                {plan.displayName}
              </CardTitle>
              <div className="flex items-center gap-1.5">
                {plan.canonicalTierId && (
                  <Badge
                    className="px-2 py-0.5 text-[10px] capitalize"
                    variant="outline"
                  >
                    {plan.canonicalTierId}
                  </Badge>
                )}
                {plan.highlighted && (
                  <Badge
                    className="bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-700 hover:bg-amber-500/25 dark:bg-amber-500/10 dark:text-amber-400"
                    variant="secondary"
                  >
                    Featured
                  </Badge>
                )}
              </div>
            </div>
            {plan.description && (
              <CardDescription className="line-clamp-2 text-sm">
                {plan.description}
              </CardDescription>
            )}
          </div>
          <div className="shrink-0 text-right">
            <div className="font-bold text-2xl tracking-tight">
              ${plan.price}
            </div>
            <div className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
              {plan.currency} / {plan.interval ?? "month"}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 pb-4">
        <div className="space-y-4">
          {plan.features && plan.features.length > 0 ? (
            <ul className="grid gap-2 text-sm">
              {plan.features.slice(0, MAX_FEATURES_DISPLAY).map((feature) => (
                <li
                  className="flex items-start gap-2 text-muted-foreground"
                  key={feature}
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="leading-tight">{feature}</span>
                </li>
              ))}
              {plan.features.length > MAX_FEATURES_DISPLAY && (
                <li className="pl-6 text-muted-foreground text-xs italic">
                  + {plan.features.length - MAX_FEATURES_DISPLAY} more features
                </li>
              )}
            </ul>
          ) : (
            <div className="py-2 text-muted-foreground text-sm italic">
              No features defined for this plan.
            </div>
          )}

          <div className="mt-4 flex items-center gap-4 rounded-md bg-muted/40 p-2 text-xs">
            <div className="flex items-center gap-1.5">
              {plan.visible ? (
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <X className="h-3.5 w-3.5 text-destructive" />
              )}
              <span className="font-medium text-muted-foreground">
                {plan.visible ? "Visible in UI" : "Hidden from UI"}
              </span>
            </div>
            <div className="h-3 w-px bg-border" />
            <div className="text-muted-foreground">
              Order:{" "}
              <span className="font-medium text-foreground">
                {plan.displayOrder ?? "None"}
              </span>
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="justify-between gap-2 border-t bg-muted/10 pt-4">
        <div
          className="max-w-[200px] truncate font-mono text-muted-foreground text-xs"
          title={plan.id}
        >
          ID: {plan.id}
        </div>
        <div className="flex gap-2">
          <Button
            className="h-8 gap-1.5"
            onClick={onStartEdit}
            size="sm"
            type="button"
            variant="outline"
          >
            <Edit2 className="h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            className="h-8 gap-1.5"
            onClick={onDelete}
            size="sm"
            type="button"
            variant="outline"
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
            Delete
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Synced Plan Card
// ---------------------------------------------------------------------------

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Card renders different layouts per sync status
function SyncedPlanCard({
  view,
  isEditing,
  onStartEdit,
  onCancelEdit,
}: {
  view: SyncedPlanView;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
}) {
  const syncMutation = useSyncMutation();
  const importMutation = useImportMutation();
  const deleteMutation = useDeletePlanMutation();
  const [showDiffs, setShowDiffs] = useState(false);

  const handleDelete = () => {
    if (view.localPlan) {
      deleteMutation.mutate(view.localPlan.id);
    }
  };

  // Synced plan (has local, has remote, no diffs)
  if (view.syncStatus === "synced" && view.localPlan) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <SyncStatusBadge status="synced" />
        </div>
        <PlanEditCard
          isEditing={isEditing}
          onCancelEdit={onCancelEdit}
          onDelete={handleDelete}
          onStartEdit={onStartEdit}
          plan={view.localPlan}
        />
      </div>
    );
  }

  // Local-only plan
  if (view.syncStatus === "local-only" && view.localPlan) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <SyncStatusBadge status="local-only" />
          <Button
            className="h-7 gap-1.5 text-xs"
            disabled={syncMutation.isPending}
            onClick={() =>
              syncMutation.mutate({
                planId: view.localPlan?.id ?? "",
                direction: "push-to-provider",
              })
            }
            size="sm"
            type="button"
            variant="outline"
          >
            {syncMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <ArrowUpFromLine className="h-3 w-3" />
            )}
            Push to Provider
          </Button>
        </div>
        <PlanEditCard
          isEditing={isEditing}
          onCancelEdit={onCancelEdit}
          onDelete={handleDelete}
          onStartEdit={onStartEdit}
          plan={view.localPlan}
        />
      </div>
    );
  }

  // Remote-only plan
  if (view.syncStatus === "remote-only" && view.remoteProduct) {
    const product = view.remoteProduct;
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <SyncStatusBadge status="remote-only" />
        </div>
        <Card className="flex flex-col overflow-hidden border-amber-500/30 border-dashed transition-all duration-200">
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-1.5">
                <CardTitle className="font-semibold text-xl leading-none">
                  {product.name}
                </CardTitle>
                {product.description && (
                  <CardDescription className="line-clamp-2 text-sm">
                    {product.description}
                  </CardDescription>
                )}
              </div>
              <div className="shrink-0 text-right">
                <div className="font-bold text-2xl tracking-tight">
                  {formatPrice(product.price.amount, product.price.currency)}
                </div>
                <div className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
                  / {product.interval}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 pb-4">
            <div className="flex items-center gap-4 rounded-md bg-muted/40 p-2 text-xs">
              <div className="text-muted-foreground">
                Type:{" "}
                <span className="font-medium text-foreground">
                  {product.type}
                </span>
              </div>
              <div className="h-3 w-px bg-border" />
              <div className="text-muted-foreground">
                Provider ID:{" "}
                <span className="font-medium font-mono text-foreground">
                  {product.id}
                </span>
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-end gap-2 border-t bg-muted/10 pt-4">
            <Button
              className="gap-1.5"
              disabled={importMutation.isPending}
              onClick={() =>
                importMutation.mutate({ remoteProductId: product.id })
              }
              size="sm"
              type="button"
            >
              {importMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ArrowDownToLine className="h-3.5 w-3.5" />
              )}
              Import to DB
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Out-of-sync plan
  if (view.syncStatus === "out-of-sync" && view.localPlan) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <SyncStatusBadge status="out-of-sync" />
          <Button
            className="h-7 gap-1.5 text-xs"
            onClick={() => setShowDiffs((p) => !p)}
            size="sm"
            type="button"
            variant="ghost"
          >
            {showDiffs ? "Hide" : "Show"} Differences ({view.diffs.length})
          </Button>
        </div>
        <Card className="overflow-hidden border-red-500/30 ring-1 ring-red-500/10">
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-1.5">
                <CardTitle className="font-semibold text-xl leading-none">
                  {getPlanDisplayName(view)}
                </CardTitle>
                {view.localPlan.description && (
                  <CardDescription className="line-clamp-2 text-sm">
                    {view.localPlan.description}
                  </CardDescription>
                )}
              </div>
              <div className="shrink-0 text-right">
                <div className="font-bold text-2xl tracking-tight">
                  ${view.localPlan.price}
                </div>
                <div className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
                  {view.localPlan.currency} /{" "}
                  {view.localPlan.interval ?? "month"}
                </div>
              </div>
            </div>
          </CardHeader>
          {showDiffs && (
            <CardContent className="border-t pt-4">
              <DiffTable diffs={view.diffs} planId={view.localPlan.id} />
            </CardContent>
          )}
          <CardFooter className="justify-between gap-2 border-t bg-muted/10 pt-4">
            <div
              className="max-w-[200px] truncate font-mono text-muted-foreground text-xs"
              title={view.localPlan.id}
            >
              ID: {view.localPlan.id}
            </div>
            <div className="text-muted-foreground text-xs">
              Resolve differences above to enable editing
            </div>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Create Plan Sheet
// ---------------------------------------------------------------------------

function CreatePlanSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [form, setForm] = useState<CreatePlanState>({
    ...INITIAL_CREATE_STATE,
  });
  const createMutation = useCreatePlanMutation();

  const handleSubmit = () => {
    if (!form.displayName.trim()) {
      toast.error("Display name is required");
      return;
    }
    if (!form.price.trim()) {
      toast.error("Price is required");
      return;
    }

    let parsedLimits: Record<string, number> = {};
    try {
      parsedLimits = JSON.parse(form.limits);
    } catch {
      toast.error("Invalid JSON in limits field");
      return;
    }

    const data: Record<string, unknown> = {
      displayName: form.displayName.trim(),
      description: form.description.trim() || null,
      canonicalTierId: form.canonicalTierId,
      price: form.price,
      currency: form.currency,
      interval: form.interval,
      intervalCount: Number(form.intervalCount) || 1,
      features: form.features
        .split("\n")
        .map((f) => f.trim())
        .filter(Boolean),
      limits: parsedLimits,
      permissions: form.permissions
        .split("\n")
        .map((p) => p.trim())
        .filter(Boolean),
      displayOrder: form.displayOrder ? Number(form.displayOrder) : null,
      highlighted: form.highlighted,
      visible: form.visible,
    };

    createMutation.mutate(data, {
      onSuccess: () => {
        setForm({ ...INITIAL_CREATE_STATE });
        onOpenChange(false);
      },
    });
  };

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Create Plan</SheetTitle>
          <SheetDescription>
            Add a new subscription plan. It will be synced with the payment
            provider automatically.
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-6 py-6">
          <div className="space-y-2">
            <Label>Display Name *</Label>
            <Input
              onChange={(e) =>
                setForm((s) => ({ ...s, displayName: e.target.value }))
              }
              placeholder="e.g. Pro Plan (Monthly)"
              value={form.displayName}
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              onChange={(e) =>
                setForm((s) => ({ ...s, description: e.target.value }))
              }
              placeholder="Short description"
              value={form.description}
            />
          </div>

          <div className="space-y-2">
            <Label>Canonical Tier</Label>
            <Select
              onValueChange={(v) =>
                setForm((s) => ({ ...s, canonicalTierId: v }))
              }
              value={form.canonicalTierId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select tier" />
              </SelectTrigger>
              <SelectContent>
                {TIER_OPTIONS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Price *</Label>
              <Input
                onChange={(e) =>
                  setForm((s) => ({ ...s, price: e.target.value }))
                }
                placeholder="9.99"
                type="number"
                value={form.price}
              />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Input
                onChange={(e) =>
                  setForm((s) => ({ ...s, currency: e.target.value }))
                }
                placeholder="USD"
                value={form.currency}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Interval</Label>
              <Select
                onValueChange={(v) => setForm((s) => ({ ...s, interval: v }))}
                value={form.interval}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select interval" />
                </SelectTrigger>
                <SelectContent>
                  {INTERVAL_OPTIONS.map((i) => (
                    <SelectItem key={i.value} value={i.value}>
                      {i.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Interval Count</Label>
              <Input
                onChange={(e) =>
                  setForm((s) => ({ ...s, intervalCount: e.target.value }))
                }
                placeholder="1"
                type="number"
                value={form.intervalCount}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex justify-between">
              <span>Features</span>
              <span className="font-normal text-muted-foreground text-xs">
                One per line
              </span>
            </Label>
            <Textarea
              className="min-h-[100px] resize-y"
              onChange={(e) =>
                setForm((s) => ({ ...s, features: e.target.value }))
              }
              placeholder={
                "Unlimited projects\nPriority support\nCustom domains"
              }
              value={form.features}
            />
          </div>

          <div className="space-y-2">
            <Label>Limits (JSON)</Label>
            <Textarea
              className="min-h-[80px] font-mono text-xs"
              onChange={(e) =>
                setForm((s) => ({ ...s, limits: e.target.value }))
              }
              placeholder={'{\n  "maxProjects": 10\n}'}
              value={form.limits}
            />
          </div>

          <div className="space-y-2">
            <Label className="flex justify-between">
              <span>Permissions</span>
              <span className="font-normal text-muted-foreground text-xs">
                One per line
              </span>
            </Label>
            <Textarea
              className="min-h-[80px] resize-y"
              onChange={(e) =>
                setForm((s) => ({ ...s, permissions: e.target.value }))
              }
              placeholder={"create:project\nmanage:billing"}
              value={form.permissions}
            />
          </div>

          <div className="space-y-2">
            <Label>Display Order</Label>
            <Input
              onChange={(e) =>
                setForm((s) => ({ ...s, displayOrder: e.target.value }))
              }
              placeholder="0, 1, 2..."
              type="number"
              value={form.displayOrder}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4">
            <div className="space-y-0.5">
              <Label>Highlighted</Label>
              <p className="text-muted-foreground text-xs">
                Mark as a featured plan
              </p>
            </div>
            <Switch
              checked={form.highlighted}
              onCheckedChange={(v) =>
                setForm((s) => ({ ...s, highlighted: v }))
              }
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4">
            <div className="space-y-0.5">
              <Label>Visible</Label>
              <p className="text-muted-foreground text-xs">
                Show on the pricing page
              </p>
            </div>
            <Switch
              checked={form.visible}
              onCheckedChange={(v) => setForm((s) => ({ ...s, visible: v }))}
            />
          </div>
        </div>

        <SheetFooter>
          <Button
            className="w-full gap-2"
            disabled={createMutation.isPending}
            onClick={handleSubmit}
            type="button"
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Create Plan
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function PlansSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      {SKELETON_ITEMS.map((i) => (
        <Card className="flex flex-col" key={i}>
          <CardHeader className="flex-row items-start justify-between gap-4 pb-4">
            <div className="flex-1 space-y-3">
              <Skeleton className="h-6 w-2/3" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-16" />
              </div>
              <Skeleton className="h-4 w-full" />
            </div>
            <div className="space-y-2 text-right">
              <Skeleton className="ml-auto h-8 w-24" />
              <Skeleton className="ml-auto h-4 w-16" />
            </div>
          </CardHeader>
          <CardContent className="flex-1 space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
            <Skeleton className="mt-4 h-10 w-full" />
          </CardContent>
          <CardFooter className="justify-between border-t pt-4">
            <Skeleton className="h-4 w-32" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-20" />
            </div>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export function PlanSyncScreen() {
  const { data, isLoading, error, refetch } = useSyncStatusQuery();
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [createSheetOpen, setCreateSheetOpen] = useState(false);

  const plans = data?.plans ?? [];
  const provider = data?.provider ?? "unknown";

  const syncedCount = plans.filter((p) => p.syncStatus === "synced").length;
  const outOfSyncCount = plans.filter(
    (p) => p.syncStatus === "out-of-sync"
  ).length;
  const localOnlyCount = plans.filter(
    (p) => p.syncStatus === "local-only"
  ).length;
  const remoteOnlyCount = plans.filter(
    (p) => p.syncStatus === "remote-only"
  ).length;

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6">
      {/* Header Section */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-bold text-3xl tracking-tight">Plan Sync</h2>
          <p className="mt-1 text-muted-foreground">
            Bidirectional sync between local database and payment provider.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            className="gap-2 shadow-sm"
            onClick={() => setCreateSheetOpen(true)}
            type="button"
          >
            <Plus className="h-4 w-4" />
            Create Plan
          </Button>
          <Button
            className="gap-2 shadow-sm"
            disabled={isLoading}
            onClick={() => refetch()}
            type="button"
            variant="outline"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      {!(isLoading || error) && plans.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Package className="h-4 w-4" />
            <span>{plans.length} Total</span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <Check className="h-4 w-4" />
            <span>{syncedCount} Synced</span>
          </div>
          {outOfSyncCount > 0 && (
            <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" />
              <span>{outOfSyncCount} Out of Sync</span>
            </div>
          )}
          {localOnlyCount > 0 && (
            <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
              <Database className="h-4 w-4" />
              <span>{localOnlyCount} Local Only</span>
            </div>
          )}
          {remoteOnlyCount > 0 && (
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <Cloud className="h-4 w-4" />
              <span>{remoteOnlyCount} Remote Only</span>
            </div>
          )}
          <Badge className="capitalize" variant="outline">
            {provider}
          </Badge>
        </div>
      )}

      {/* Content Section */}
      {renderContent()}

      {/* Create Plan Sheet */}
      <CreatePlanSheet
        onOpenChange={setCreateSheetOpen}
        open={createSheetOpen}
      />
    </div>
  );

  function renderContent() {
    if (isLoading) {
      return <PlansSkeleton />;
    }

    if (error) {
      return (
        <Card className="overflow-hidden border-destructive/50 bg-destructive/5">
          <div className="h-1 w-full bg-destructive/50" />
          <CardContent className="flex flex-col items-center justify-center space-y-4 pt-8 pb-8 text-center">
            <div className="rounded-full bg-destructive/10 p-3">
              <ServerCrash className="h-8 w-8 text-destructive" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-destructive text-lg">
                Failed to load sync status
              </h3>
              <p className="mx-auto max-w-md text-muted-foreground text-sm">
                There was a problem communicating with the server. Please check
                your connection and try again.
              </p>
            </div>
            <Button
              className="mt-2 gap-2"
              onClick={() => refetch()}
              type="button"
              variant="outline"
            >
              <RefreshCw className="h-4 w-4" />
              Retry Connection
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (plans.length === 0) {
      return (
        <Card className="border-2 border-dashed bg-muted/10">
          <CardContent className="flex flex-col items-center justify-center space-y-4 pt-12 pb-12 text-center">
            <div className="rounded-full bg-primary/10 p-4">
              <Package className="h-10 w-10 text-primary" />
            </div>
            <div className="max-w-sm space-y-1">
              <h3 className="font-semibold text-xl">No plans found</h3>
              <p className="text-muted-foreground text-sm">
                No subscription plans found locally or remotely. Create a new
                plan or check your payment provider configuration.
              </p>
            </div>
            <Button
              className="mt-2 gap-2"
              onClick={() => setCreateSheetOpen(true)}
              type="button"
            >
              <Plus className="h-4 w-4" />
              Create Plan
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {plans.map((view) => {
          const key = getPlanKey(view);
          return (
            <SyncedPlanCard
              isEditing={editingPlanId === view.localPlan?.id}
              key={key}
              onCancelEdit={() => setEditingPlanId(null)}
              onStartEdit={() => {
                if (view.localPlan) {
                  setEditingPlanId(view.localPlan.id);
                }
              }}
              view={view}
            />
          );
        })}
      </div>
    );
  }
}
