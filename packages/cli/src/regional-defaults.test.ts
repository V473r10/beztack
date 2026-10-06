import { describe, expect, it } from "vitest";
import {
  applyRegionalDefaults,
  requireRegionalDefaults,
  validateCurrencyCode,
  validateLocale,
} from "./regional-defaults.js";

describe("validateCurrencyCode", () => {
  it.each(["USD", "UYU", "JPY", "eur", " brl "])("accepts %j", (value) => {
    expect(validateCurrencyCode(value)).toBeUndefined();
  });

  it.each([undefined, "", "  ", "US", "DOLLARS", "ZZZ"])("rejects %j", (value) => {
    expect(validateCurrencyCode(value)).toEqual(expect.any(String));
  });
});

describe("validateLocale", () => {
  it.each(["en", "en-US", "es-UY", "pt-BR"])("accepts %j", (value) => {
    expect(validateLocale(value)).toBeUndefined();
  });

  it.each([undefined, "", "not a locale", "en_US"])("rejects %j", (value) => {
    expect(validateLocale(value)).toEqual(expect.any(String));
  });
});

describe("requireRegionalDefaults", () => {
  it("normalizes valid input", () => {
    expect(requireRegionalDefaults({ currency: " eur ", locale: " fr-FR " })).toEqual({
      currency: "EUR",
      locale: "fr-FR",
    });
  });

  it("refuses a missing currency instead of picking one", () => {
    expect(() => requireRegionalDefaults({ locale: "en-US" })).toThrow("--currency");
  });

  it("refuses a missing locale instead of picking one", () => {
    expect(() => requireRegionalDefaults({ currency: "USD" })).toThrow("--locale");
  });
});

describe("applyRegionalDefaults", () => {
  const defaults = { currency: "JPY", locale: "ja-JP" };

  it("fills the API and UI entries of an env file", () => {
    const content = [
      "# Project regional defaults",
      "# DEFAULT_CURRENCY: ISO 4217 code (e.g. USD).",
      "DEFAULT_CURRENCY=",
      "DEFAULT_LOCALE=",
      "VITE_DEFAULT_CURRENCY=",
      "VITE_DEFAULT_LOCALE=",
      "APP_NAME=beztack",
    ].join("\n");

    expect(applyRegionalDefaults(content, defaults)).toBe(
      [
        "# Project regional defaults",
        "# DEFAULT_CURRENCY: ISO 4217 code (e.g. USD).",
        "DEFAULT_CURRENCY=JPY",
        "DEFAULT_LOCALE=ja-JP",
        "VITE_DEFAULT_CURRENCY=JPY",
        "VITE_DEFAULT_LOCALE=ja-JP",
        "APP_NAME=beztack",
      ].join("\n"),
    );
  });

  it("replaces an existing value", () => {
    expect(applyRegionalDefaults("DEFAULT_CURRENCY=USD\n", defaults)).toBe(
      "DEFAULT_CURRENCY=JPY\n",
    );
  });

  it("leaves files without regional entries untouched", () => {
    const content = "VITE_API_URL=http://localhost:3000\n";
    expect(applyRegionalDefaults(content, defaults)).toBe(content);
  });
});
