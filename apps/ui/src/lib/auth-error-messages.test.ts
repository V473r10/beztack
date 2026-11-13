import i18next, { type TFunction } from "i18next";
import { beforeAll, describe, expect, it } from "vitest";
import en from "./i18n/locales/en.json";
import es from "./i18n/locales/es.json";
import { getAuthErrorMessage, readAuthError } from "./auth-error-messages";

let t: TFunction;

beforeAll(async () => {
  const instance = i18next.createInstance();
  await instance.init({
    lng: "en",
    resources: { en: { translation: en }, es: { translation: es } },
    interpolation: { escapeValue: false },
  });
  t = instance.t;
});

const inSpanish = async () => {
  const instance = i18next.createInstance();
  await instance.init({
    lng: "es",
    resources: { en: { translation: en }, es: { translation: es } },
    interpolation: { escapeValue: false },
  });
  return instance.t;
};

describe("getAuthErrorMessage", () => {
  it("translates a known better-auth code in English and Spanish", async () => {
    const error = { code: "USER_ALREADY_EXISTS", message: "User already exists." };

    expect(getAuthErrorMessage(t, error)).toBe(
      "An account with this email already exists. Sign in instead.",
    );
    expect(getAuthErrorMessage(await inSpanish(), error)).toBe(
      "Ya existe una cuenta con este email. Iniciá sesión.",
    );
  });

  it("translates wrong credentials on sign-in", () => {
    expect(getAuthErrorMessage(t, { code: "INVALID_EMAIL_OR_PASSWORD" })).toBe(
      "Incorrect email or password.",
    );
  });

  it("keeps translating the two-factor codes", () => {
    expect(getAuthErrorMessage(t, { code: "INVALID_TOTP_CODE" })).toBe(
      "Invalid TOTP code. Please try again.",
    );
  });

  it("falls back to the server message when the code is unknown", () => {
    expect(
      getAuthErrorMessage(t, { code: "SOMETHING_NEW", message: "Payment provider down" }),
    ).toBe("Payment provider down");
  });

  it("uses the fallback key with the server message when one is given", () => {
    expect(
      getAuthErrorMessage(
        t,
        { message: "boom" },
        "notifications.twoFactor.errors.verificationFailed",
      ),
    ).toBe("Verification failed: boom");
  });

  it("says the server failed when a 5xx has neither a known code nor a message", async () => {
    expect(getAuthErrorMessage(t, { status: 500 })).toBe(
      "Something went wrong on our side. Please try again in a moment.",
    );
    expect(getAuthErrorMessage(await inSpanish(), { status: 500 })).toBe(
      "Algo salió mal de nuestro lado. Probá de nuevo en un momento.",
    );
  });

  it("falls back to a generic message when there is nothing else", () => {
    expect(getAuthErrorMessage(t, {})).toBe("An unexpected error occurred. Please try again.");
  });
});

describe("readAuthError", () => {
  it("returns the error of a better-auth `{ data, error }` result", () => {
    const error = { status: 500, statusText: "Internal Server Error", message: "x" };

    expect(readAuthError({ data: null, error })).toBe(error);
  });

  it("returns null for a successful result", () => {
    expect(readAuthError({ data: { user: { id: "u1" } }, error: null })).toBeNull();
    expect(readAuthError(undefined)).toBeNull();
    expect(readAuthError({ data: {} })).toBeNull();
  });
});
