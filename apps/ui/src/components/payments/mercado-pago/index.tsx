import { env } from "@/env";
import MercadoPagoButtonComponent from "./mercado-pago-btn";
import PaymentBrickComponent from "./payment-brick";

type MercadoPagoCheckoutProps = {
  amount: number;
  title?: string;
  quantity?: number;
  description?: string;
  onSuccess?: (paymentId: number, status: string) => void;
  onError?: (error: Error) => void;
};

const MercadoPagoCheckout = ({
  amount,
  title = "Payment",
  quantity = 1,
  description,
  onSuccess,
  onError,
}: MercadoPagoCheckoutProps) => {
  const checkoutType = env.VITE_MERCADO_PAGO_CHECKOUT_TYPE;

  if (checkoutType === "bricks") {
    return (
      <PaymentBrickComponent
        amount={amount}
        description={description ?? title}
        onError={onError}
        onSuccess={onSuccess}
      />
    );
  }

  return (
    <MercadoPagoButtonComponent
      quantity={quantity}
      title={title}
      unitPrice={amount}
    />
  );
};

export default MercadoPagoCheckout;
export type { MercadoPagoCheckoutProps };
export { default as MercadoPagoButton } from "./mercado-pago-btn";
export { default as PaymentBrick } from "./payment-brick";
