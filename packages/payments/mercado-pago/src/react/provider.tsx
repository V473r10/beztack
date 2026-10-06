import { initMercadoPago } from "@mercadopago/sdk-react";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import type { MercadoPagoLocale } from "./locale.js";

export type { MercadoPagoLocale } from "./locale.js";

// ============================================================================
// Types
// ============================================================================

export type MercadoPagoContextValue = {
  publicKey: string;
  apiBaseUrl: string;
  /** Undefined when the SDK uses its own default locale. */
  locale?: MercadoPagoLocale;
  isInitialized: boolean;
  endpoints: {
    preference: string;
    processPayment: string;
    plans: string;
    subscriptions: string;
    events: string;
  };
};

export type MercadoPagoProviderProps = {
  publicKey: string;
  apiBaseUrl: string;
  /**
   * SDK checkout locale. Pass the project locale through
   * `resolveMercadoPagoLocale`; omitted -> the SDK's own default.
   */
  locale?: MercadoPagoLocale;
  children: ReactNode;
};

// ============================================================================
// Context
// ============================================================================

const MercadoPagoContext = createContext<MercadoPagoContextValue | null>(null);

// ============================================================================
// Hook
// ============================================================================

export function useMercadoPagoContext(): MercadoPagoContextValue {
  const context = useContext(MercadoPagoContext);
  if (!context) {
    throw new Error("useMercadoPagoContext must be used within a MercadoPagoProvider");
  }
  return context;
}

// ============================================================================
// Provider Component
// ============================================================================

declare global {
  interface Window {
    MercadoPago?: unknown;
  }
}

export function MercadoPagoProvider({
  publicKey,
  apiBaseUrl,
  locale,
  children,
}: MercadoPagoProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!window.MercadoPago && publicKey) {
      initMercadoPago(publicKey, locale ? { locale } : undefined);
    }
    setIsInitialized(true);
  }, [publicKey, locale]);

  const value = useMemo<MercadoPagoContextValue>(() => {
    const basePaymentsUrl = `${apiBaseUrl}/api/payments/mercado-pago`;
    return {
      publicKey,
      apiBaseUrl,
      locale,
      isInitialized,
      endpoints: {
        preference: `${basePaymentsUrl}/preference`,
        processPayment: `${basePaymentsUrl}/process-payment`,
        plans: `${basePaymentsUrl}/subscriptions/plans`,
        subscriptions: `${basePaymentsUrl}/subscriptions`,
        events: `${basePaymentsUrl}/events`,
      },
    };
  }, [publicKey, apiBaseUrl, locale, isInitialized]);

  return <MercadoPagoContext.Provider value={value}>{children}</MercadoPagoContext.Provider>;
}
