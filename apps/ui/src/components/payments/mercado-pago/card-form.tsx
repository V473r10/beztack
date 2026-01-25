import { CardPayment, initMercadoPago } from "@mercadopago/sdk-react";
import { useCallback, useEffect, useState } from "react";
import { env } from "@/env";

declare global {
  interface Window {
    MercadoPago?: unknown;
  }
}

type CardFormData = {
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

type CardFormProps = {
  amount: number;
  description?: string;
  onSuccess?: (paymentId: number, status: string) => void;
  onError?: (error: Error) => void;
};

type PaymentResponse = {
  id: number;
  status: string;
  status_detail: string;
};

const CardForm = ({
  amount,
  description = "Payment",
  onSuccess,
  onError,
}: CardFormProps) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const publicKey = env.VITE_MERCADO_PAGO_PUBLIC_KEY;
  const processPaymentEndpoint = `${env.VITE_API_URL}/api/payments/mercado-pago/process-payment`;

  useEffect(() => {
    if (!window.MercadoPago && publicKey) {
      initMercadoPago(publicKey, {
        locale: "es-UY",
      });
    }
    setIsInitialized(true);
  }, [publicKey]);

  const initialization = {
    amount,
  };

  const onSubmit = useCallback(
    async (formData: unknown) => {
      const data = formData as CardFormData;
      try {
        const response = await fetch(processPaymentEndpoint, {
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
          const errorData = await response.json();
          throw new Error(errorData.message || "Payment failed");
        }

        const result: PaymentResponse = await response.json();
        onSuccess?.(result.id, result.status);
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error("Payment failed"));
      }
    },
    [amount, description, onSuccess, onError, processPaymentEndpoint]
  );

  const handleError = useCallback(
    (error: { type: string; cause: string; message: string }) => {
      onError?.(new Error(error.message || "Card form error"));
    },
    [onError]
  );

  if (!isInitialized) {
    return <div className="h-64 animate-pulse rounded-lg bg-muted" />;
  }

  return (
    <CardPayment
      customization={{
        paymentMethods: {
          maxInstallments: 12,
        },
        visual: {
          style: {
            theme: "default",
          },
        },
      }}
      initialization={initialization}
      onError={handleError}
      onSubmit={onSubmit}
    />
  );
};

export default CardForm;
