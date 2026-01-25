import { Loader2 } from "lucide-react";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppForm } from "@/components/ui/tanstack-form";
import { useCreatePlan } from "@/hooks/use-mercado-pago-plans";
import {
  type CreatePlanData,
  createPlanSchema,
} from "@/lib/mercado-pago-types";

type CreatePlanFormProps = {
  onSuccess?: () => void;
  onCancel?: () => void;
};

const DEFAULT_VALUES: CreatePlanData = {
  reason: "",
  auto_recurring: {
    frequency: 1,
    frequency_type: "months",
    transaction_amount: 0,
    currency_id: "UYU",
  },
};

export function CreatePlanForm({ onSuccess, onCancel }: CreatePlanFormProps) {
  const createPlan = useCreatePlan();

  const form = useAppForm({
    validators: { onChange: createPlanSchema },
    defaultValues: DEFAULT_VALUES,
    onSubmit: async ({ value }) => {
      try {
        await createPlan.mutateAsync(value);
        form.reset();
        onSuccess?.();
      } catch {
        // Error handled by mutation
      }
    },
  });

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      e.stopPropagation();
      form.handleSubmit();
    },
    [form]
  );

  return (
    <form.AppForm>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <form.AppField name="reason">
          {(field) => (
            <field.FormItem>
              <field.FormLabel>Nombre del Plan</field.FormLabel>
              <field.FormControl>
                <Input
                  disabled={createPlan.isPending}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Ej: Plan Premium Mensual"
                  value={field.state.value}
                />
              </field.FormControl>
              <field.FormMessage />
            </field.FormItem>
          )}
        </form.AppField>

        <div className="grid grid-cols-2 gap-4">
          <form.AppField name="auto_recurring.transaction_amount">
            {(field) => (
              <field.FormItem>
                <field.FormLabel>Monto</field.FormLabel>
                <field.FormControl>
                  <Input
                    disabled={createPlan.isPending}
                    min={1}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(Number(e.target.value))}
                    placeholder="500"
                    type="number"
                    value={field.state.value || ""}
                  />
                </field.FormControl>
                <field.FormMessage />
              </field.FormItem>
            )}
          </form.AppField>

          <form.AppField name="auto_recurring.currency_id">
            {(field) => (
              <field.FormItem>
                <field.FormLabel>Moneda</field.FormLabel>
                <Select
                  disabled={createPlan.isPending}
                  onValueChange={field.handleChange}
                  value={field.state.value}
                >
                  <field.FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Moneda" />
                    </SelectTrigger>
                  </field.FormControl>
                  <SelectContent>
                    <SelectItem value="UYU">UYU</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
                <field.FormMessage />
              </field.FormItem>
            )}
          </form.AppField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <form.AppField name="auto_recurring.frequency">
            {(field) => (
              <field.FormItem>
                <field.FormLabel>Frecuencia</field.FormLabel>
                <field.FormControl>
                  <Input
                    disabled={createPlan.isPending}
                    max={12}
                    min={1}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(Number(e.target.value))}
                    type="number"
                    value={field.state.value}
                  />
                </field.FormControl>
                <field.FormMessage />
              </field.FormItem>
            )}
          </form.AppField>

          <form.AppField name="auto_recurring.frequency_type">
            {(field) => (
              <field.FormItem>
                <field.FormLabel>Período</field.FormLabel>
                <Select
                  disabled={createPlan.isPending}
                  onValueChange={(value) =>
                    field.handleChange(value as "days" | "months")
                  }
                  value={field.state.value}
                >
                  <field.FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </field.FormControl>
                  <SelectContent>
                    <SelectItem value="days">Días</SelectItem>
                    <SelectItem value="months">Meses</SelectItem>
                  </SelectContent>
                </Select>
                <field.FormMessage />
              </field.FormItem>
            )}
          </form.AppField>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          {onCancel && (
            <Button
              disabled={createPlan.isPending}
              onClick={onCancel}
              type="button"
              variant="outline"
            >
              Cancelar
            </Button>
          )}
          <Button disabled={createPlan.isPending} type="submit">
            {createPlan.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Crear Plan
          </Button>
        </div>
      </form>
    </form.AppForm>
  );
}
