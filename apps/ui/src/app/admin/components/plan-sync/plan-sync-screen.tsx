import {
  AlertTriangle,
  Check,
  Cloud,
  Database,
  Package,
  Plus,
  RefreshCw,
  ServerCrash,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CreatePlanSheet } from "./components/create-plan-sheet";
import { PlansSkeleton } from "./components/plans-skeleton";
import { SyncedPlanCard } from "./components/synced-plan-card";
import { getPlanKey } from "./helpers";
import { useSyncStatusQuery } from "./hooks";

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
      <div className="grid min-w-4xl grid-cols-1 gap-6">
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
