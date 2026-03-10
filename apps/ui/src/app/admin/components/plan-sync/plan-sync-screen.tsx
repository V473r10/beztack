import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Check,
  CheckCircle2,
  CloudLightning,
  CreditCard,
  Edit2,
  Loader2,
  Package,
  RefreshCw,
  Save,
  ServerCrash,
  Upload,
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { env } from "@/env";
import { cn } from "@/lib/utils";

const API_URL = env.VITE_API_URL;

type DbPlan = {
  id: string;
  reason: string;
  status: string;
  frequency: number;
  frequencyType: string;
  transactionAmount: string;
  currencyId: string;
  initPoint: string | null;
  canonicalTierId: string | null;
  displayName: string | null;
  description: string | null;
  features: string[] | null;
  limits: Record<string, number> | null;
  permissions: string[] | null;
  displayOrder: number | null;
  highlighted: boolean | null;
  visible: boolean | null;
  dateCreated: string | null;
  lastModified: string | null;
  createdAt: string;
  updatedAt: string;
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

const TIER_OPTIONS = [
  { value: "free", label: "Free" },
  { value: "basic", label: "Basic" },
  { value: "pro", label: "Pro" },
  { value: "ultimate", label: "Ultimate" },
];

const MAX_FEATURES_DISPLAY = 4;
// biome-ignore lint/style/noMagicNumbers: Skeleton items array
const SKELETON_ITEMS = [1, 2, 3, 4] as const;

function usePlansQuery() {
  return useQuery<{ plans: DbPlan[]; total: number }>({
    queryKey: ["admin-plans"],
    queryFn: async () => {
      const res = await fetch(
        `${API_URL}/api/payments/mercado-pago/subscriptions/plans`,
        { credentials: "include" }
      );
      if (!res.ok) {
        throw new Error("Failed to fetch plans");
      }
      return res.json();
    },
  });
}

function useSyncMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `${API_URL}/api/payments/mercado-pago/subscriptions/plans/sync`,
        { method: "POST", credentials: "include" }
      );
      if (!res.ok) {
        throw new Error("Sync failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
      toast.success(
        `Synced ${data.stats.total} plans (${data.stats.created} new, ${data.stats.updated} updated)`
      );
    },
    onError: () => {
      toast.error("Failed to sync plans from Mercado Pago");
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
      const res = await fetch(
        `${API_URL}/api/payments/mercado-pago/subscriptions/plans/${planId}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );
      if (!res.ok) {
        throw new Error("Update failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
      toast.success("Plan updated successfully");
    },
    onError: () => {
      toast.error("Failed to update plan");
    },
  });
}

function usePushPlanMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (planId: string) => {
      const res = await fetch(
        `${API_URL}/api/payments/mercado-pago/subscriptions/plans/${planId}/push`,
        { method: "POST", credentials: "include" }
      );
      if (!res.ok) {
        throw new Error("Push failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
      toast.success("Plan pushed to Mercado Pago");
    },
    onError: () => {
      toast.error("Failed to push plan to Mercado Pago");
    },
  });
}

function planToEditState(plan: DbPlan): EditState {
  return {
    canonicalTierId: plan.canonicalTierId,
    displayName: plan.displayName ?? plan.reason,
    description: plan.description ?? "",
    features: (plan.features ?? []).join("\n"),
    limits: plan.limits ? JSON.stringify(plan.limits, null, 2) : "{}",
    permissions: (plan.permissions ?? []).join("\n"),
    displayOrder: plan.displayOrder,
    highlighted: plan.highlighted ?? false,
    visible: plan.visible ?? true,
  };
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: A bit complex but breaking it up would make it harder to read
function PlanEditCard({
  plan,
  isEditing,
  onStartEdit,
  onCancelEdit,
}: {
  plan: DbPlan;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
}) {
  const [editState, setEditState] = useState<EditState>(planToEditState(plan));
  const updateMutation = useUpdatePlanMutation();
  const pushMutation = usePushPlanMutation();

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

  const isActive = plan.status === "active";
  const isHighlighted = plan.highlighted;

  if (isEditing) {
    return (
      <Card className="border-primary/50 shadow-md ring-1 ring-primary/20">
        <CardHeader className="border-b bg-muted/30 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">
                Edit Plan: {plan.reason}
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
                variant="ghost"
              >
                Cancel
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-8 pt-6">
          {/* Basic Info */}
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
                    setEditState((s) => ({ ...s, displayName: e.target.value }))
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
                  setEditState((s) => ({ ...s, description: e.target.value }))
                }
                placeholder="Short description displayed under the plan name"
                value={editState.description}
              />
            </div>
          </div>

          <Separator />

          {/* Features & Limits */}
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
                    setEditState((s) => ({ ...s, features: e.target.value }))
                  }
                  placeholder="Unlimited projects&#10;Priority support&#10;Custom domains"
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
                    setEditState((s) => ({ ...s, permissions: e.target.value }))
                  }
                  placeholder="create:project&#10;manage:billing"
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

          {/* Presentation */}
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
                {plan.displayName ?? plan.reason}
              </CardTitle>
              <div className="flex items-center gap-1.5">
                <Badge
                  className={cn(
                    "px-2 py-0.5 text-[10px] uppercase",
                    isActive &&
                      "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-400",
                    !isActive && "bg-muted text-muted-foreground"
                  )}
                  variant={isActive ? "default" : "secondary"}
                >
                  {plan.status}
                </Badge>
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
              ${plan.transactionAmount}
            </div>
            <div className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
              {plan.currencyId} / {plan.frequency} {plan.frequencyType}
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
            disabled={pushMutation.isPending}
            onClick={() => pushMutation.mutate(plan.id)}
            size="sm"
            title="Push settings back to Mercado Pago"
            variant="secondary"
          >
            {pushMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Push
          </Button>
          <Button
            className="h-8 gap-1.5"
            onClick={onStartEdit}
            size="sm"
            variant="outline"
          >
            <Edit2 className="h-3.5 w-3.5" />
            Edit
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

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
              <Skeleton className="h-8 w-20" />
            </div>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

export function PlanSyncScreen() {
  const { data, isLoading, error } = usePlansQuery();
  const syncMutation = useSyncMutation();
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);

  const plans = data?.plans ?? [];
  const activePlans = plans.filter((p) => p.status === "active").length;

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6">
      {/* Header Section */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-bold text-3xl tracking-tight">
            Subscription Plans
          </h2>
          <p className="mt-1 text-muted-foreground">
            Manage your Mercado Pago subscription plans, pricing tiers, and
            features.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!(isLoading || error) && plans.length > 0 && (
            <div className="mr-2 hidden items-center gap-4 text-muted-foreground text-sm sm:flex">
              <div className="flex items-center gap-1.5">
                <Package className="h-4 w-4" />
                <span>{plans.length} Total</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>{activePlans} Active</span>
              </div>
            </div>
          )}
          <Button
            className="gap-2 shadow-sm"
            disabled={syncMutation.isPending}
            onClick={() => syncMutation.mutate()}
          >
            {syncMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CloudLightning className="h-4 w-4" />
            )}
            Sync from Mercado Pago
          </Button>
        </div>
      </div>

      {/* Content Section */}
      {renderContent()}
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
                Failed to load plans
              </h3>
              <p className="mx-auto max-w-md text-muted-foreground text-sm">
                There was a problem communicating with the server. Please check
                your connection and try again.
              </p>
            </div>
            <Button
              className="mt-2 gap-2"
              onClick={() => syncMutation.mutate()}
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
              <h3 className="font-semibold text-xl">No plans configured</h3>
              <p className="text-muted-foreground text-sm">
                You don't have any subscription plans in your local database
                yet. Sync them from Mercado Pago to get started.
              </p>
            </div>
            <Button
              className="mt-4 gap-2"
              disabled={syncMutation.isPending}
              onClick={() => syncMutation.mutate()}
              size="lg"
            >
              {syncMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CloudLightning className="h-4 w-4" />
              )}
              Sync Now
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {plans.map((plan) => (
          <PlanEditCard
            isEditing={editingPlanId === plan.id}
            key={plan.id}
            onCancelEdit={() => setEditingPlanId(null)}
            onStartEdit={() => setEditingPlanId(plan.id)}
            plan={plan}
          />
        ))}
      </div>
    );
  }
}
