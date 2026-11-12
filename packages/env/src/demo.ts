/**
 * Fail-closed guard for the public live demo (`DEMO_MODE=true`, docs/demo.md).
 *
 * A demo lets anonymous visitors start checkouts, so the process must not boot
 * with a payment provider that could move real money. Anything that is not
 * positively known to be a sandbox is refused.
 */
export type DemoPaymentsConfig = {
  paymentProvider: "polar" | "mercadopago";
  /** Resolved `POLAR_SERVER`. */
  polarServer: "sandbox" | "production";
  /**
   * `DEMO_MERCADO_PAGO_SANDBOX_CONFIRMED`. Mercado Pago test credentials share
   * the `APP_USR-` prefix of live ones, so the token cannot prove a sandbox.
   */
  mercadoPagoSandboxConfirmed: boolean;
};

/** Throws unless the active payment provider is in sandbox. Never echoes secrets. */
export function assertDemoSandboxPayments(config: DemoPaymentsConfig): void {
  if (config.paymentProvider === "polar") {
    if (config.polarServer !== "sandbox") {
      throw new Error(
        'DEMO_MODE refuses to start: POLAR_SERVER must be "sandbox" when PAYMENT_PROVIDER=polar',
      );
    }
    return;
  }

  if (config.paymentProvider === "mercadopago") {
    if (!config.mercadoPagoSandboxConfirmed) {
      throw new Error(
        "DEMO_MODE refuses to start: set DEMO_MERCADO_PAGO_SANDBOX_CONFIRMED=true to confirm " +
          "MERCADO_PAGO_ACCESS_TOKEN is a Mercado Pago test credential",
      );
    }
    return;
  }

  throw new Error("DEMO_MODE refuses to start: unknown PAYMENT_PROVIDER");
}
