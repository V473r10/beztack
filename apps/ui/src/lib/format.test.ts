import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "i18next";
import {
  formatDate,
  formatMercadoPagoAmount,
  formatNumber,
  formatPrice,
  formatRelativeFromNow,
  setFormatLanguageSource,
} from "./format";

vi.mock("@/env", () => ({
  env: {
    VITE_DEFAULT_CURRENCY: "EUR",
    VITE_DEFAULT_LOCALE: "de-DE",
  },
}));

/** Intl separates symbol and number with narrow/no-break spaces; compare on plain spaces. */
function plain(value: string): string {
  return value.replace(/[\u00a0\u202f]/g, " ");
}

describe("formatPrice", () => {
  // Amounts are integer minor units of their currency (ADR 0007).
  it("reads the amount as minor units of the price's own currency", () => {
    expect(plain(formatPrice(900, "USD", "en-US"))).toBe("$9.00");
    expect(plain(formatPrice(1500, "JPY", "en-US"))).toBe("¥1,500");
    expect(plain(formatPrice(1500, "KWD", "en-US"))).toBe("KWD 1.500");
    expect(plain(formatPrice(39_000, "UYU", "es-UY"))).toBe("$ 390,00");
  });

  it("uses the project currency and locale when the price carries none", () => {
    expect(plain(formatPrice(2900))).toBe("29,00 €");
    expect(plain(formatPrice(2900, null))).toBe("29,00 €");
    expect(plain(formatPrice(2900, ""))).toBe("29,00 €");
  });

  it("keeps the price's own currency in the project locale", () => {
    expect(plain(formatPrice(1500, "JPY"))).toBe("1.500 ¥");
  });

  it("refuses an amount that is not whole minor units instead of showing a wrong price", () => {
    expect(() => formatPrice(9.99, "USD", "en-US")).toThrow(RangeError);
  });

  describe("with an active i18n language", () => {
    beforeEach(async () => {
      await i18n.init({ lng: "en", resources: {}, showSupportNotice: false });
    });

    afterEach(async () => {
      await i18n.changeLanguage("en");
    });

    it("formats in the language the user chose", async () => {
      expect(plain(formatPrice(900, "USD"))).toBe("$9.00");

      await i18n.changeLanguage("es");
      expect(plain(formatPrice(900, "USD", "es"))).toBe("9,00 US$");
    });

    it("keeps the project's region when it is the same language", async () => {
      await i18n.changeLanguage("de");

      expect(plain(formatPrice(900, "USD"))).toBe("9,00 $"); // project locale de-DE
    });

    it("falls back to the bare language for another language", async () => {
      await i18n.changeLanguage("es");

      expect(plain(formatPrice(900, "USD"))).toBe("9,00 US$");
    });
  });
});

describe("formatMercadoPagoAmount", () => {
  it("converts a Mercado Pago decimal once and formats it like any other price", () => {
    expect(plain(formatMercadoPagoAmount(9.99, "USD", "en-US"))).toBe("$9.99");
    expect(plain(formatMercadoPagoAmount("390", "UYU", "es-UY"))).toBe("$ 390,00");
    expect(plain(formatMercadoPagoAmount(1500, "JPY", "en-US"))).toBe("¥1,500");
  });
});

describe("formatDate", () => {
  it("formats in the project locale until the user has a language", () => {
    setFormatLanguageSource({});

    expect(formatDate("2026-03-05T12:00:00Z", { dateStyle: "long", timeZone: "UTC" })).toBe(
      "5. März 2026",
    );

    setFormatLanguageSource(undefined);
  });

  it("formats in the language the user chose", async () => {
    await i18n.changeLanguage("es");

    expect(formatDate("2026-03-05T12:00:00Z", { dateStyle: "long", timeZone: "UTC" })).toBe(
      "5 de marzo de 2026",
    );

    await i18n.changeLanguage("en");
  });

  it("formats in an explicit locale", () => {
    expect(
      formatDate("2026-03-05T12:00:00Z", { dateStyle: "long", timeZone: "UTC" }, "en-US"),
    ).toBe("March 5, 2026");
  });
});

describe("formatRelativeFromNow", () => {
  const NOW = new Date("2026-03-05T12:00:00Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats future dates in the project locale until the user has a language", () => {
    setFormatLanguageSource({});

    expect(formatRelativeFromNow("2026-03-08T12:00:00Z")).toBe("in 3 Tagen");

    setFormatLanguageSource(undefined);
  });

  it("formats in the language the user chose", async () => {
    await i18n.changeLanguage("es");

    expect(formatRelativeFromNow("2026-03-08T12:00:00Z")).toBe("dentro de 3 días");

    await i18n.changeLanguage("en");

    expect(formatRelativeFromNow("2026-03-08T12:00:00Z")).toBe("in 3 days");
  });

  it("formats past dates in an explicit locale", () => {
    expect(formatRelativeFromNow(new Date("2026-03-03T12:00:00Z"), "en-US")).toBe("2 days ago");
    expect(formatRelativeFromNow("2026-03-08T12:00:00Z", "es")).toBe("dentro de 3 días");
  });

  it("picks the largest sensible unit", () => {
    expect(formatRelativeFromNow("2026-03-05T12:00:30Z", "en-US")).toBe("in 30 seconds");
    expect(formatRelativeFromNow("2026-03-05T09:00:00Z", "en-US")).toBe("3 hours ago");
    expect(formatRelativeFromNow("2026-05-05T12:00:00Z", "en-US")).toBe("in 2 months");
    expect(formatRelativeFromNow("2028-03-05T12:00:00Z", "en-US")).toBe("in 2 years");
  });
});

describe("formatNumber", () => {
  it("groups digits in an explicit locale", () => {
    expect(formatNumber(1_234_567, undefined, "en-US")).toBe("1,234,567");
    expect(formatNumber(1_234_567, undefined, "es")).toBe("1.234.567");
  });

  it("formats in the language the user chose", async () => {
    await i18n.changeLanguage("es");

    expect(formatNumber(12_500)).toBe("12.500");

    await i18n.changeLanguage("en");

    expect(formatNumber(12_500)).toBe("12,500");
  });
});
