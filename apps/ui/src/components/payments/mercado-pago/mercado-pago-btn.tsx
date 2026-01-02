import { initMercadoPago, Wallet } from "@mercadopago/sdk-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { env } from "@/env";

declare global {
  interface Window {
    MercadoPago?: unknown;
  }
}

type MercadoPagoButtonProps = {
  title?: string;
  unitPrice?: number;
  quantity?: number;
};

const MercadoPagoButton = ({
  title = "Pago de prueba",
  unitPrice = 1000,
  quantity = 1,
}: MercadoPagoButtonProps) => {
  const [preferenceId, setPreferenceId] = useState<string | null>(null);
  const publicKey = env.VITE_MERCADO_PAGO_PUBLIC_KEY;
  const createPreferenceIdEndpoint = `${env.VITE_API_URL}/api/payments/mercado-pago/preference`;

  useEffect(() => {
    if (!window.MercadoPago) {
      initMercadoPago(publicKey, {
        locale: "es-UY",
      });
    }
  }, [publicKey]);

  const createPreferenceId = async () => {
    // TODO: Implement preference creation logic
    const response = await fetch(createPreferenceIdEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        unit_price: unitPrice,
        quantity,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to create preference");
    }

    const data = await response.json();
    setPreferenceId(data.id);
  };

  return (
    <>
      <Button onClick={createPreferenceId}>Pagar con Mercado Pago</Button>
      {preferenceId && (
        <Wallet customization={{}} initialization={{ preferenceId }} />
      )}
    </>
  );
};

export default MercadoPagoButton;
