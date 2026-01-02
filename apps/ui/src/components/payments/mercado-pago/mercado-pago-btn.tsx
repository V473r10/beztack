import { initMercadoPago, Wallet } from "@mercadopago/sdk-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { env } from "@/env";

const MercadoPagoButton = () => {
  const [preferenceId, setPreferenceId] = useState<string | null>(null);
  const publicKey = env.VITE_MERCADO_PAGO_PUBLIC_KEY;
  const createPreferenceIdEndpoint = `${env.VITE_API_URL}/api/payments/mercado-pago/preference`;

  useEffect(() => {
    if (!window.MercadoPago) {
      console.log("Initializing MercadoPago");
      initMercadoPago(publicKey, {
        locale: "es-UY", // optional
      });
      console.log("MercadoPago initialized");
      return;
    }
    console.log("MercadoPago already initialized");
  }, [publicKey]);

  const createPreferenceId = async () => {
    // TODO: Implement preference creation logic
    const response = await fetch(createPreferenceIdEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Pago de prueba",
        unit_price: 1000,
        quantity: 1,
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
