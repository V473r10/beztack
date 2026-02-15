import { Payment } from "@mercadopago/sdk-react";
import { useCallback, useState } from "react";
import { useMercadoPagoContext } from "../provider.js";

// ============================================================================
// Types
// ============================================================================

type PaymentFormData = {
  token: string;
  issuer_id: number;
  payment_method_id: string;
  installments: number;
  payer: {
    email: string;
    identification?: {
      type: string;
      number: string;
    };
  };
};

type BrickError = {
  type: string;
  cause: string;
  message: string;
};

export type PaymentBrickProps = {
  amount: number;
  description?: string;
  onSuccess?: (paymentId: number, status: string) => void;
  onError?: (error: Error) => void;
  onReady?: () => void;
  className?: string;
};

type PaymentResponse = {
  id: number;
  status: string;
  status_detail: string;
};

// ============================================================================
// Component
// ============================================================================

export function PaymentBrick({
  amount,
  description = "Payment",
  onSuccess,
  onError,
  onReady,
  className,
}: PaymentBrickProps) {
  const { endpoints, isInitialized } = useMercadoPagoContext();
  const [isProcessing, setIsProcessing] = useState(false);

  const initialization = {
    amount,
  };

  const customization = {
    paymentMethods: {
      creditCard: "all" as const,
      debitCard: "all" as const,
      maxInstallments: 12,
    },
    visual: {
      style: {
        theme: "default" as const,
      },
    },
  };

  const handleSubmit = useCallback(
    async (formData: unknown) => {
      const data = formData as PaymentFormData;
      setIsProcessing(true);
      try {
        const response = await fetch(endpoints.processPayment, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token: data.token,
            issuer_id: data.issuer_id,
            payment_method_id: data.payment_method_id,
            transaction_amount: amount,
            installments: data.installments,
            description,
            payer: {
              email: data.payer.email,
              identification: data.payer.identification,
            },
          }),
        });

        if (!response.ok) {
          const errorData = (await response.json().catch(() => ({}))) as {
            message?: string;
          };
          throw new Error(errorData.message ?? "Payment failed");
        }

        const result: PaymentResponse = await response.json();
        onSuccess?.(result.id, result.status);
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error("Payment failed"));
      } finally {
        setIsProcessing(false);
      }
    },
    [amount, description, onSuccess, onError, endpoints.processPayment]
  );

  const handleError = useCallback(
    (error: BrickError) => {
      onError?.(new Error(error.message ?? "Brick error"));
    },
    [onError]
  );

  const handleReady = useCallback(() => {
    onReady?.();
  }, [onReady]);

  if (!isInitialized) {
    return (
      <div
        className={`h-64 animate-pulse rounded-lg bg-muted ${className ?? ""}`}
      />
    );
  }

  return (
    <div className={className} data-processing={isProcessing}>
      <Payment
        customization={customization}
        initialization={initialization}
        onError={handleError}
        onReady={handleReady}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
