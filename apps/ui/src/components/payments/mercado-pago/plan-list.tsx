import { type Plan, usePlans, useSyncPlans } from "@beztack/mercadopago/react";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { CreatePlanForm } from "./create-plan-form";
import { PlanCard } from "./plan-card";

type PlanListProps = {
  selectedPlanId?: string;
  onSelect: (plan: Plan) => void;
};

export function PlanList({ selectedPlanId, onSelect }: PlanListProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const { data, isLoading, error } = usePlans({ status: "active" });
  const syncPlans = useSyncPlans();

  const plans = data?.plans ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
        <p className="text-destructive text-sm">
          Error al cargar planes: {error.message}
        </p>
        <Button
          className="mt-2"
          onClick={() => syncPlans.mutate()}
          size="sm"
          variant="outline"
        >
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-muted-foreground text-sm">
          {plans.length} plan{plans.length !== 1 ? "es" : ""} disponible
          {plans.length !== 1 ? "s" : ""}
        </h3>
        <div className="flex gap-2">
          <Button
            disabled={syncPlans.isPending}
            onClick={() => syncPlans.mutate()}
            size="sm"
            variant="ghost"
          >
            {syncPlans.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="sr-only">Sincronizar</span>
          </Button>
        </div>
      </div>

      {plans.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              onSelect={onSelect}
              plan={plan}
              selected={plan.id === selectedPlanId}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground text-sm">
            No hay planes creados aún
          </p>
        </div>
      )}

      <Collapsible onOpenChange={setShowCreateForm} open={showCreateForm}>
        <CollapsibleTrigger asChild>
          <Button className="w-full" variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            {showCreateForm ? "Cancelar" : "Crear nuevo plan"}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4">
          <div className="rounded-lg border bg-muted/30 p-4">
            <CreatePlanForm
              onCancel={() => setShowCreateForm(false)}
              onSuccess={() => setShowCreateForm(false)}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
