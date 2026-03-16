import {
  Activity,
  Check,
  CheckCircle2,
  CreditCard,
  Edit2,
  Loader2,
  Package,
  Save,
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MAX_FEATURES_DISPLAY, TIER_OPTIONS } from "../constants";
import { planToEditState } from "../helpers";
import { useUpdatePlanMutation } from "../hooks";
import type { DbPlan, EditState } from "../types";

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Edit card has many fields
export function PlanEditCard({
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
      <Card className="w-full border-primary/50 shadow-md ring-1 ring-primary/20">
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
        "flex w-full flex-col overflow-hidden ring-1 ring-transparent transition-all duration-200",
        isActive
          ? "border-border hover:border-primary/40 hover:shadow-md"
          : "border-dashed bg-muted/20 opacity-80",
        isHighlighted &&
          isActive &&
          "border-primary/50 shadow-sm ring-primary/10"
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
