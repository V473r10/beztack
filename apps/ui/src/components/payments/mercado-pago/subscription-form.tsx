import { useState } from "react";
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
import { env } from "@/env";

type SubscriptionFormProps = {
  planId?: string;
  reason?: string;
  amount?: number;
  frequency?: number;
  frequencyType?: "days" | "months";
  currencyId?: string;
  onSuccess?: (subscriptionId: string, initPoint: string) => void;
  onError?: (error: Error) => void;
};

type SubscriptionResponse = {
  id: string;
  status: string;
  init_point: string;
};

const SubscriptionForm = ({
  planId,
  reason = "Subscription",
  amount = 1000,
  frequency: initialFrequency = 1,
  frequencyType: initialFrequencyType = "months",
  currencyId = "UYU",
  onSuccess,
  onError,
}: SubscriptionFormProps) => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [frequency, setFrequency] = useState(initialFrequency);
  const [frequencyType, setFrequencyType] = useState(initialFrequencyType);
  const subscriptionsEndpoint = `${env.VITE_API_URL}/api/payments/mercado-pago/subscriptions`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const body = planId
        ? {
            preapproval_plan_id: planId,
            payer_email: email,
          }
        : {
            reason,
            payer_email: email,
            auto_recurring: {
              frequency,
              frequency_type: frequencyType,
              transaction_amount: amount,
              currency_id: currencyId,
            },
          };

      const response = await fetch(subscriptionsEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create subscription");
      }

      const data: SubscriptionResponse = await response.json();
      onSuccess?.(data.id, data.init_point);

      if (data.init_point) {
        window.location.href = data.init_point;
      }
    } catch (error) {
      onError?.(
        error instanceof Error ? error : new Error("Subscription failed")
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          disabled={isLoading}
          id="email"
          onChange={(e) => setEmail(e.target.value)}
          placeholder="test_user_xxxxx@testuser.com"
          required
          type="email"
          value={email}
        />
        <p className="text-muted-foreground text-xs">
          En modo sandbox, usa el email de un usuario de prueba de Mercado Pago
        </p>
      </div>

      {!planId && (
        <>
          <div className="space-y-2">
            <Label>Plan</Label>
            <div className="flex gap-2">
              <Select
                defaultValue={String(frequency)}
                disabled={isLoading}
                onValueChange={(v) => setFrequency(Number.parseInt(v, 10))}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="6">6</SelectItem>
                  <SelectItem value="12">12</SelectItem>
                </SelectContent>
              </Select>
              <Select
                defaultValue={frequencyType}
                disabled={isLoading}
                onValueChange={(v) => setFrequencyType(v as "days" | "months")}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="days">Días</SelectItem>
                  <SelectItem value="months">Meses</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg bg-muted p-4">
            <p className="font-medium text-lg">
              {currencyId} {amount.toLocaleString()}
              <span className="font-normal text-muted-foreground text-sm">
                {" "}
                / cada {frequency}{" "}
                {frequencyType === "months" ? "mes(es)" : "día(s)"}
              </span>
            </p>
          </div>
        </>
      )}

      <Button className="w-full" disabled={isLoading} type="submit">
        {isLoading ? "Procesando..." : "Suscribirse"}
      </Button>
    </form>
  );
};

export default SubscriptionForm;
