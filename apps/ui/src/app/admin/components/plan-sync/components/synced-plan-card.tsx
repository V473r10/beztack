import { ArrowDownToLine, ArrowUpFromLine, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatPrice, getPlanDisplayName } from "../helpers";
import {
  useDeletePlanMutation,
  useImportMutation,
  useSyncMutation,
} from "../hooks";
import type { SyncedPlanView } from "../types";
import { DiffTable } from "./diff-table";
import { PlanEditCard } from "./plan-edit-card";
import { SyncStatusBadge } from "./sync-status-badge";

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Card renders different layouts per sync status
export function SyncedPlanCard({
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
