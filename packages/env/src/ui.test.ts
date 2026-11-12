import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function stubUiEnv(overrides: Record<string, string | undefined>): void {
  const values: Record<string, string | undefined> = {
    VITE_API_URL: "http://localhost:3000",
    VITE_PAYMENT_PROVIDER: "polar",
    VITE_DEFAULT_CURRENCY: "JPY",
    VITE_DEFAULT_LOCALE: "ja-JP",
    ...overrides,
  };
  for (const [name, value] of Object.entries(values)) {
    vi.stubEnv(name, value);
  }
}

async function loadUiEnv() {
  const mod = await import("./ui");
  return mod.env;
}

describe("UI env: project currency and locale", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("exposes VITE_DEFAULT_CURRENCY and VITE_DEFAULT_LOCALE as configured", async () => {
    stubUiEnv({});

    const env = await loadUiEnv();

    expect(env.VITE_DEFAULT_CURRENCY).toBe("JPY");
    expect(env.VITE_DEFAULT_LOCALE).toBe("ja-JP");
  });

  it("refuses to load without VITE_DEFAULT_CURRENCY", async () => {
    stubUiEnv({ VITE_DEFAULT_CURRENCY: undefined });

    await expect(loadUiEnv()).rejects.toThrow();
  });

  it("refuses to load without VITE_DEFAULT_LOCALE", async () => {
    stubUiEnv({ VITE_DEFAULT_LOCALE: undefined });

    await expect(loadUiEnv()).rejects.toThrow();
  });
});

describe("UI env: VITE_DEMO_MODE", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("is off by default", async () => {
    stubUiEnv({});

    const env = await loadUiEnv();

    expect(env.VITE_DEMO_MODE).toBe(false);
  });

  it("turns on with VITE_DEMO_MODE=true", async () => {
    stubUiEnv({ VITE_DEMO_MODE: "true" });

    const env = await loadUiEnv();

    expect(env.VITE_DEMO_MODE).toBe(true);
  });

  it("rejects a value that is not true or false", async () => {
    stubUiEnv({ VITE_DEMO_MODE: "yes" });

    await expect(loadUiEnv()).rejects.toThrow();
  });
});
