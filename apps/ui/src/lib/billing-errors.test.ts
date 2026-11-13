import i18next, { type TFunction } from "i18next";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api-client";
import {
  getBillingErrorMessage,
  isOrganizationRequiredError,
  runWithOrganization,
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
