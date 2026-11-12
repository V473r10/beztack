import { describe, expect, it } from "vitest";
import { assertDemoSandboxPayments, type DemoPaymentsConfig } from "./demo";

function config(overrides: Partial<DemoPaymentsConfig>): DemoPaymentsConfig {
  return {
    paymentProvider: "polar",
    polarServer: "sandbox",
    mercadoPagoSandboxConfirmed: false,
    ...overrides,
  };
}

describe("assertDemoSandboxPayments", () => {
  it("accepts Polar on the sandbox server", () => {
    expect(() => assertDemoSandboxPayments(config({}))).not.toThrow();
  });

  it("rejects Polar on the production server", () => {
    expect(() => assertDemoSandboxPayments(config({ polarServer: "production" }))).toThrow(
      /POLAR_SERVER must be "sandbox"/,
    );
  });

  it("ignores the Mercado Pago confirmation when Polar is production", () => {
    expect(() =>
      assertDemoSandboxPayments(
        config({ polarServer: "production", mercadoPagoSandboxConfirmed: true }),
      ),
    ).toThrow();
  });

  it("rejects Mercado Pago without the confirmation", () => {
    expect(() => assertDemoSandboxPayments(config({ paymentProvider: "mercadopago" }))).toThrow(
      /DEMO_MERCADO_PAGO_SANDBOX_CONFIRMED/,
    );
  });

  it("accepts Mercado Pago with the confirmation, whatever POLAR_SERVER says", () => {
    expect(() =>
      assertDemoSandboxPayments(
        config({
          paymentProvider: "mercadopago",
          polarServer: "production",
          mercadoPagoSandboxConfirmed: true,
        }),
      ),
    ).not.toThrow();
  });

  it("rejects an unknown provider", () => {
    expect(() =>
      assertDemoSandboxPayments(config({ paymentProvider: "stripe" as "polar" })),
    ).toThrow(/unknown PAYMENT_PROVIDER/);
  });
});
