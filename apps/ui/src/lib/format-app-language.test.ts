import i18next from "i18next";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDate, formatPrice, setFormatLanguageSource } from "./format";

vi.mock("@/env", () => ({
  env: { VITE_DEFAULT_CURRENCY: "USD", VITE_DEFAULT_LOCALE: "en-US" },
}));

/** Intl separates symbol and number with narrow/no-break spaces; compare on plain spaces. */
function plain(value: string): string {
  return value.replace(/[\u00a0\u202f]/g, " ");
}

describe("formatters with the app's own i18n instance", () => {
  afterEach(() => setFormatLanguageSource(undefined));

  // The app creates its instance with createInstance(); the default i18next singleton never
  // gets a language, so the formatters are told where the user's language lives.
  it("follows the language chosen in that instance", async () => {
    const appInstance = i18next.createInstance();
    await appInstance.init({
      lng: "es",
      resources: {},
      showSupportNotice: false,
    });

    setFormatLanguageSource(appInstance);

    expect(plain(formatPrice(2900, "USD"))).toBe("29,00 US$");

    await appInstance.changeLanguage("en");

    expect(plain(formatPrice(2900, "USD"))).toBe("$29.00");
  });

  it("writes dates in the chosen language too", async () => {
    const appInstance = i18next.createInstance();
    await appInstance.init({
      lng: "es",
      resources: {},
      showSupportNotice: false,
    });

    setFormatLanguageSource(appInstance);

    expect(formatDate("2026-11-30T12:00:00Z", { dateStyle: "long", timeZone: "UTC" })).toBe(
      "30 de noviembre de 2026",
    );
  });
});
