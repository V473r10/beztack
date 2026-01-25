import { Wallet } from "@mercadopago/sdk-react";
import { useCallback, useState } from "react";
import { useMercadoPagoContext } from "../provider.js";

// ============================================================================
// Types
// ============================================================================

export type CheckoutButtonProps = {
  title: string;
  unitPrice: number;
  quantity?: number;
  description?: string;
  onPreferenceCreated?: (preferenceId: string) => void;
  onError?: (error: Error) => void;
  renderTrigger?: (props: {
    onClick: () => void;
    isLoading: boolean;
  }) => React.ReactNode;
  className?: string;
};

// ============================================================================
// Component
// ============================================================================

export function CheckoutButton({
  title,
  unitPrice,
  quantity = 1,
  description,
  onPreferenceCreated,
  onError,
  renderTrigger,
  className,
}: CheckoutButtonProps) {
  const { endpoints, isInitialized } = useMercadoPagoContext();
  const [preferenceId, setPreferenceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const createPreference = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(endpoints.preference, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          unit_price: unitPrice,
          quantity,
          description,
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(errorData.message ?? "Failed to create preference");
      }

      const data = (await response.json()) as { id: string };
      setPreferenceId(data.id);
      onPreferenceCreated?.(data.id);
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Unknown error");
      onError?.(err);
    } finally {
      setIsLoading(false);
    }
  }, [
    endpoints.preference,
    title,
    unitPrice,
    quantity,
    description,
    onPreferenceCreated,
    onError,
  ]);

  if (!isInitialized) {
    return (
      <div
        className={`h-12 animate-pulse rounded-lg bg-muted ${className ?? ""}`}
      />
    );
  }

  return (
    <div className={className}>
      {renderTrigger ? (
        renderTrigger({ onClick: createPreference, isLoading })
      ) : (
        <button
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50"
          disabled={isLoading}
          onClick={createPreference}
          type="button"
        >
          {isLoading ? "Cargando..." : "Pagar con Mercado Pago"}
        </button>
      )}
      {preferenceId && (
        <Wallet customization={{}} initialization={{ preferenceId }} />
      )}
    </div>
  );
}
