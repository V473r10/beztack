/**
 * Provider-agnostic payment context wrapper.
 *
 * Conditionally loads the active payment provider's React context.
 * When a provider is removed by a codemod, its lazy import line is deleted.
 */
import { lazy, type ReactNode, Suspense } from "react";
import { env } from "@/env";

// --- Provider lazy imports (codemod boundary) ---
const MercadoPagoProvider = lazy(() =>
  import("@beztack/mercadopago/react").then((m) => ({
    default: m.MercadoPagoProvider,
  }))
);
// --- End provider lazy imports ---

type PaymentProviderWrapperProps = {
  children: ReactNode;
};

export function PaymentProviderWrapper({
  children,
}: PaymentProviderWrapperProps) {
  const provider = env.VITE_PAYMENT_PROVIDER;

  if (provider === "mercadopago") {
    const publicKey = env.VITE_MERCADO_PAGO_PUBLIC_KEY ?? "";
    if (!publicKey) {
      return <>{children}</>;
    }

    return (
      <Suspense fallback={children}>
        <MercadoPagoProvider
          apiBaseUrl={env.VITE_API_URL}
          publicKey={publicKey}
        >
          {children}
        </MercadoPagoProvider>
      </Suspense>
    );
  }

  // Polar and other providers don't need a React context wrapper
  return <>{children}</>;
}
