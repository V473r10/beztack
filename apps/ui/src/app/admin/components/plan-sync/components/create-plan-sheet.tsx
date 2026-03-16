import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  INITIAL_CREATE_STATE,
  INTERVAL_OPTIONS,
  TIER_OPTIONS,
} from "../constants";
import { useCreatePlanMutation } from "../hooks";
import type { CreatePlanState } from "../types";

export function CreatePlanSheet({
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
