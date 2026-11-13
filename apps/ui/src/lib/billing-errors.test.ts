import { readFileSync } from "node:fs";
import path from "node:path";
import i18next, { type TFunction } from "i18next";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api-client";
import {
  getBillingErrorMessage,
  isOrganizationRequiredError,
  isProviderRateLimitedError,
  runWithOrganization,
  shouldRetryBillingQuery,
} from "./billing-errors";
import en from "./i18n/locales/en.json";
import es from "./i18n/locales/es.json";

vi.mock("@/env", () => ({ env: { VITE_API_URL: "https://api.example.test" } }));

const FALLBACK = "Failed to start checkout process";

async function translator(lng: "en" | "es"): Promise<TFunction> {
  const instance = i18next.createInstance();
  await instance.init({
    lng,
    resources: { en: { translation: en }, es: { translation: es } },
    interpolation: { escapeValue: false },
  });
  return instance.t;
}

function apiError(statusCode: number, message: string, code?: string) {
  return new ApiError(message, { statusCode, data: code ? { code } : undefined });
}

let t: TFunction;
let tEs: TFunction;

beforeAll(async () => {
  t = await translator("en");
  tEs = await translator("es");
});

describe("getBillingErrorMessage", () => {
  it("shows the server's message when the error has no known code", () => {
    const error = apiError(400, "Could not resolve checkout product for the selected plan");

    expect(getBillingErrorMessage(t, error, FALLBACK)).toBe(
      "Could not resolve checkout product for the selected plan",
    );
  });

  it("translates a known error code, in English and Spanish", () => {
    const error = apiError(
      422,
      "The payment provider rejected this email",
      "customer_email_rejected",
    );

    expect(getBillingErrorMessage(t, error, FALLBACK)).toBe(
      "The payment provider rejected your email address. Use a different email.",
    );
    expect(getBillingErrorMessage(tEs, error, FALLBACK)).toContain("correo");
  });

  it("falls back to the server message for an unknown code", () => {
    const error = apiError(409, "This plan is not available yet", "some_new_code");

    expect(getBillingErrorMessage(t, error, FALLBACK)).toBe("This plan is not available yet");
  });

  it("uses the fallback when the error carries no message", () => {
    expect(getBillingErrorMessage(t, new Error(""), FALLBACK)).toBe(FALLBACK);
    expect(getBillingErrorMessage(t, "boom", FALLBACK)).toBe(FALLBACK);
  });

  it("uses the fallback for the generic request failure", () => {
    expect(getBillingErrorMessage(t, apiError(500, "Request failed"), FALLBACK)).toBe(FALLBACK);
  });
});

describe("isOrganizationRequiredError", () => {
  it("recognises a 409 organization_required answer", () => {
    expect(isOrganizationRequiredError(apiError(409, "x", "organization_required"))).toBe(true);
  });

  it("ignores other errors", () => {
    expect(isOrganizationRequiredError(apiError(409, "x", "other"))).toBe(false);
    expect(isOrganizationRequiredError(apiError(403, "x"))).toBe(false);
    expect(isOrganizationRequiredError(new Error("organization_required"))).toBe(false);
  });
});

describe("runWithOrganization", () => {
  it("runs once with the given organization when it succeeds", async () => {
    const run = vi.fn().mockResolvedValue("done");
    const askForOrganization = vi.fn();

    await expect(runWithOrganization(run, "org_1", askForOrganization)).resolves.toBe("done");

    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith("org_1");
    expect(askForOrganization).not.toHaveBeenCalled();
  });

  it("asks for an organization on organization_required, then retries with the new id", async () => {
    const run = vi
      .fn()
      .mockRejectedValueOnce(apiError(409, "x", "organization_required"))
      .mockResolvedValueOnce("done");
    const askForOrganization = vi.fn().mockResolvedValue("org_new");

    await expect(runWithOrganization(run, undefined, askForOrganization)).resolves.toBe("done");

    expect(run).toHaveBeenNthCalledWith(1, undefined);
    expect(run).toHaveBeenNthCalledWith(2, "org_new");
  });

  it("stops without retrying when the user closes the dialog", async () => {
    const run = vi.fn().mockRejectedValue(apiError(409, "x", "organization_required"));
    const askForOrganization = vi.fn().mockResolvedValue(null);

    await expect(runWithOrganization(run, undefined, askForOrganization)).resolves.toBeUndefined();

    expect(run).toHaveBeenCalledTimes(1);
  });

  it("rethrows any other error", async () => {
    const failure = apiError(403, "Billing manager access required");
    const run = vi.fn().mockRejectedValue(failure);

    await expect(runWithOrganization(run, "org_1", vi.fn())).rejects.toBe(failure);
  });
});

describe("every error code the billing API sends has a translation", () => {
  const apiUtils = path.resolve(__dirname, "../../../api/server/utils");

  function sentCodes(): string[] {
    const planChange = readFileSync(path.join(apiUtils, "plan-change.ts"), "utf8");
    const union = /export type PlanChangeErrorCode =([^;]+);/.exec(planChange)?.[1] ?? "";
    const planChangeCodes = [...union.matchAll(/"([a-z_]+)"/g)].map((match) => match[1]);

    const customer = readFileSync(path.join(apiUtils, "provider-customer.ts"), "utf8");
    const customerCodes = [...customer.matchAll(/code: "([a-z_]+)"/g)].map((match) => match[1]);

    const required = readFileSync(path.join(apiUtils, "organization-required.ts"), "utf8");
    const requiredCodes = [...required.matchAll(/_CODE = "([a-z_]+)"/g)].map((match) => match[1]);

    return [...new Set([...planChangeCodes, ...customerCodes, ...requiredCodes])];
  }

  it("finds the codes (guards the scanner itself)", () => {
    const codes = sentCodes();

    expect(codes).toEqual(
      expect.arrayContaining([
        "provider_did_not_apply",
        "customer_email_rejected",
        "organization_required",
      ]),
    );
    expect(codes.length).toBeGreaterThanOrEqual(12);
  });

  it.each(["en", "es"] as const)("has a billing.errors entry in %s for each of them", (locale) => {
    const errors = (locale === "en" ? en : es).billing.errors as Record<string, string>;
    const missing = sentCodes().filter((code) => !errors[code]);

    expect(missing).toEqual([]);
  });
});

describe("isProviderRateLimitedError", () => {
  it("recognises a 429 answer, with or without the provider_rate_limited code", () => {
    expect(isProviderRateLimitedError(apiError(429, "x", "provider_rate_limited"))).toBe(true);
    expect(isProviderRateLimitedError(apiError(429, "Too Many Requests"))).toBe(true);
  });

  it("ignores other failures", () => {
    expect(isProviderRateLimitedError(apiError(500, "x"))).toBe(false);
    expect(isProviderRateLimitedError(new Error("429"))).toBe(false);
    expect(isProviderRateLimitedError(null)).toBe(false);
  });

  it("has a translated message for the server code, in English and Spanish", () => {
    const error = apiError(429, "busy", "provider_rate_limited");

    expect(getBillingErrorMessage(t, error, FALLBACK)).toBe(
      "The payment provider is busy right now. Try again in a few seconds.",
    );
    expect(getBillingErrorMessage(tEs, error, FALLBACK)).toBe(
      "El proveedor de pagos está ocupado en este momento. Reintentá en unos segundos.",
    );
  });
});

describe("shouldRetryBillingQuery", () => {
  it("never retries a 4xx answer, 429 included: retrying a rate limit makes it worse", () => {
    expect(shouldRetryBillingQuery(0, apiError(429, "x"))).toBe(false);
    expect(shouldRetryBillingQuery(0, apiError(403, "x"))).toBe(false);
  });

  it("retries a server or network failure twice, then gives up", () => {
    expect(shouldRetryBillingQuery(0, apiError(500, "x"))).toBe(true);
    expect(shouldRetryBillingQuery(1, new TypeError("Failed to fetch"))).toBe(true);
    expect(shouldRetryBillingQuery(2, apiError(500, "x"))).toBe(false);
  });
});
