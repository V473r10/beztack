import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatFrequency,
  formatPlanPrice,
  getStatusColor,
  getStatusLabel,
  type Plan,
} from "@/lib/mercado-pago-types";
import { cn } from "@/lib/utils";

type PlanCardProps = {
  plan: Plan;
  selected?: boolean;
  onSelect?: (plan: Plan) => void;
};

export function PlanCard({ plan, selected, onSelect }: PlanCardProps) {
  const isClickable = !!onSelect;

  return (
    <Card
      className={cn(
        "relative transition-all",
        isClickable && "cursor-pointer hover:border-primary/50",
        selected && "border-primary ring-2 ring-primary/20"
      )}
      onClick={() => onSelect?.(plan)}
    >
      {selected && (
        <div className="absolute top-3 right-3">
          <CheckCircle2 className="h-5 w-5 text-primary" />
        </div>
      )}

      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg">{plan.reason}</CardTitle>
          <Badge
            className={cn("text-white", getStatusColor(plan.status))}
            variant="secondary"
          >
            {getStatusLabel(plan.status)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-2">
          <div className="flex items-baseline gap-1">
            <span className="font-bold text-2xl">
              {formatPlanPrice(plan.transactionAmount, plan.currencyId)}
            </span>
            <span className="text-muted-foreground text-sm">
              {formatFrequency(plan.frequency, plan.frequencyType)}
            </span>
          </div>

          {plan.repetitions && (
            <p className="text-muted-foreground text-sm">
              {plan.repetitions} cobros en total
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
