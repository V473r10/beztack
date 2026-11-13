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

const POLAR_ENV: Record<string, string> = {
  PAYMENT_PROVIDER: "polar",
  POLAR_ACCESS_TOKEN: "polar-test-token",
  POLAR_WEBHOOK_SECRET: "polar-test-secret",
  POLAR_ORGANIZATION_ID: "00000000-0000-4000-8000-000000000000",
  POLAR_BASIC_MONTHLY_PRODUCT_ID: "00000000-0000-4000-8000-000000000001",
  POLAR_BASIC_YEARLY_PRODUCT_ID: "00000000-0000-4000-8000-000000000002",
  POLAR_PRO_MONTHLY_PRODUCT_ID: "00000000-0000-4000-8000-000000000003",
  POLAR_PRO_YEARLY_PRODUCT_ID: "00000000-0000-4000-8000-000000000004",
  POLAR_ULTIMATE_MONTHLY_PRODUCT_ID: "00000000-0000-4000-8000-000000000005",
  POLAR_ULTIMATE_YEARLY_PRODUCT_ID: "00000000-0000-4000-8000-000000000006",
};

describe("API env: DEMO_MODE fails closed", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("is off by default", async () => {
    stubApiEnv({});

    const env = await loadApiEnv();

    expect(env.DEMO_MODE).toBe(false);
  });

  it("does not check the provider when DEMO_MODE is off", async () => {
    stubApiEnv({ ...POLAR_ENV, POLAR_SERVER: "production" });

    await expect(loadApiEnv()).resolves.toMatchObject({ DEMO_MODE: false });
  });

  it("starts on the Polar sandbox", async () => {
    stubApiEnv({ ...POLAR_ENV, DEMO_MODE: "true", POLAR_SERVER: "sandbox" });

    await expect(loadApiEnv()).resolves.toMatchObject({ DEMO_MODE: true });
  });

  it("refuses to start on the Polar production server", async () => {
    stubApiEnv({ ...POLAR_ENV, DEMO_MODE: "true", POLAR_SERVER: "production" });

    await expect(loadApiEnv()).rejects.toThrow(/POLAR_SERVER must be "sandbox"/);
  });

  it("refuses to start on Mercado Pago without the sandbox confirmation", async () => {
    stubApiEnv({ DEMO_MODE: "true" });

    await expect(loadApiEnv()).rejects.toThrow(/DEMO_MERCADO_PAGO_SANDBOX_CONFIRMED/);
  });

  it("starts on Mercado Pago once the test credentials are confirmed", async () => {
    stubApiEnv({ DEMO_MODE: "true", DEMO_MERCADO_PAGO_SANDBOX_CONFIRMED: "true" });

    await expect(loadApiEnv()).resolves.toMatchObject({ DEMO_MODE: true });
  });

  it("does not leak the payment credentials in the error", async () => {
    stubApiEnv({ DEMO_MODE: "true" });

    const error = await loadApiEnv().catch((caught: unknown) => caught);

    expect(String(error)).not.toContain(VALID_API_ENV.MERCADO_PAGO_ACCESS_TOKEN);
  });

  it("rejects a DEMO_MODE value that is not true or false", async () => {
    stubApiEnv({ DEMO_MODE: "yes" });

    await expect(loadApiEnv()).rejects.toThrow();
  });
});

describe("API env: Personal organization at sign-up", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("creates one by default", async () => {
    stubApiEnv({});

    const env = await loadApiEnv();

    expect(env.PERSONAL_ORGANIZATION_ON_SIGNUP).toBe(true);
  });

  it("can be turned off for projects that create organizations by hand", async () => {
    stubApiEnv({ PERSONAL_ORGANIZATION_ON_SIGNUP: "false" });

    const env = await loadApiEnv();

    expect(env.PERSONAL_ORGANIZATION_ON_SIGNUP).toBe(false);
  });
});
