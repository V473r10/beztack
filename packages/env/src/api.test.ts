import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A complete, valid API environment. Throwaway values only: they satisfy the
 * schema and are never used anywhere real.
 */
const VALID_API_ENV: Record<string, string> = {
  DATABASE_URL: "postgresql://test:test@localhost:5432/test",
  BETTER_AUTH_SECRET: "test-secret",
  BETTER_AUTH_URL: "http://localhost:3000",
  APP_NAME: "beztack-test",
  APP_URL: "http://localhost:5173",
  RESEND_FROM_NAME: "Beztack Test",
  RESEND_FROM_EMAIL: "test@example.test",
  RESEND_API_KEY: "test-key",
  PAYMENTS_SUCCESS_URL: "http://localhost:5173/success",
  PAYMENTS_CANCEL_URL: "http://localhost:5173/cancel",
  PAYMENT_PROVIDER: "mercadopago",
  MERCADO_PAGO_ACCESS_TOKEN: "test-token",
  MERCADO_PAGO_APPLICATION_ID: "test-app",
  DEFAULT_CURRENCY: "EUR",
  DEFAULT_LOCALE: "fr-FR",
};

function stubApiEnv(overrides: Record<string, string | undefined>): void {
  for (const [name, value] of Object.entries({ ...VALID_API_ENV, ...overrides })) {
    vi.stubEnv(name, value);
  }
}

async function loadApiEnv() {
  const mod = await import("./api");
  return mod.env;
}

describe("API env: project currency and locale", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("exposes DEFAULT_CURRENCY and DEFAULT_LOCALE as configured", async () => {
    stubApiEnv({});

    const env = await loadApiEnv();

    expect(env.DEFAULT_CURRENCY).toBe("EUR");
    expect(env.DEFAULT_LOCALE).toBe("fr-FR");
  });

  it("refuses to start without DEFAULT_CURRENCY", async () => {
    stubApiEnv({ DEFAULT_CURRENCY: undefined });

    await expect(loadApiEnv()).rejects.toThrow();
  });

  it("refuses to start without DEFAULT_LOCALE", async () => {
    stubApiEnv({ DEFAULT_LOCALE: undefined });

    await expect(loadApiEnv()).rejects.toThrow();
  });

  it("treats an empty DEFAULT_CURRENCY as missing", async () => {
    stubApiEnv({ DEFAULT_CURRENCY: "" });

    await expect(loadApiEnv()).rejects.toThrow();
  });

  it("rejects a currency that is not an ISO 4217 code", async () => {
    stubApiEnv({ DEFAULT_CURRENCY: "pesos" });

    await expect(loadApiEnv()).rejects.toThrow();
  });

  it("rejects a malformed locale", async () => {
    stubApiEnv({ DEFAULT_LOCALE: "not a locale" });

    await expect(loadApiEnv()).rejects.toThrow();
  });
});
