import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatDate, formatMercadoPagoAmount, formatPrice, formatRelativeFromNow } from "./format";
import { i18n } from "./i18n/i18n";

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

  it("uses the project currency when the price carries none", () => {
    expect(plain(formatPrice(2900))).toBe("€29.00");
    expect(plain(formatPrice(2900, null))).toBe("€29.00");
    expect(plain(formatPrice(2900, ""))).toBe("€29.00");
  });

  it("keeps the price's own currency", () => {
    expect(plain(formatPrice(1500, "JPY"))).toBe("¥1,500");
  });

  it("refuses an amount that is not whole minor units instead of showing a wrong price", () => {
    expect(() => formatPrice(9.99, "USD", "en-US")).toThrow(RangeError);
  });

  // The app's own i18n instance: the one the language selector switches.
  describe("with an active i18n language", () => {
    beforeEach(async () => {
      await i18n.changeLanguage("en");
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
      vi.resetModules();
      vi.doMock("@/env", () => ({
        env: { VITE_DEFAULT_CURRENCY: "UYU", VITE_DEFAULT_LOCALE: "es-UY" },
      }));
      const { formatPrice: formatForUruguay } = await import("./format");
      const { i18n: uruguayI18n } = await import("./i18n/i18n");
      await uruguayI18n.changeLanguage("es");

      expect(plain(formatForUruguay(2900))).toBe("$ 29,00"); // `es` alone would read "29,00 UYU"
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
  it("formats in the project locale by default", () => {
    expect(formatDate("2026-03-05T12:00:00Z", { dateStyle: "long", timeZone: "UTC" })).toBe(
      "5. März 2026",
    );
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

  it("formats future dates in the project locale", () => {
    expect(formatRelativeFromNow("2026-03-08T12:00:00Z")).toBe("in 3 Tagen");
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
