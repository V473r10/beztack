import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { currencyFractionDigits, formatDate, formatPrice, formatRelativeFromNow } from "./format";

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

describe("currencyFractionDigits", () => {
  it.each([
    ["USD", 2],
    ["EUR", 2],
    ["JPY", 0],
    ["KRW", 0],
    ["KWD", 3],
    ["BHD", 3],
  ])("%s has %i decimals", (currency, digits) => {
    expect(currencyFractionDigits(currency)).toBe(digits);
  });
});

describe("formatPrice", () => {
  it("formats in the price's own currency with that currency's decimals", () => {
    expect(plain(formatPrice(29, "USD", "en-US"))).toBe("$29.00");
    expect(plain(formatPrice(1500, "JPY", "en-US"))).toBe("¥1,500");
    expect(plain(formatPrice(1.5, "KWD", "en-US"))).toBe("KWD 1.500");
  });

  it("rounds to the currency's decimals instead of a fixed two", () => {
    expect(plain(formatPrice(1500.4, "JPY", "en-US"))).toBe("¥1,500");
    expect(plain(formatPrice(9.999, "USD", "en-US"))).toBe("$10.00");
  });

  it("accepts string amounts", () => {
    expect(plain(formatPrice("250.5", "USD", "en-US"))).toBe("$250.50");
  });

  it("uses the project currency and locale when the price carries none", () => {
    expect(plain(formatPrice(29))).toBe("29,00 €");
    expect(plain(formatPrice(29, null))).toBe("29,00 €");
    expect(plain(formatPrice(29, ""))).toBe("29,00 €");
  });

  it("keeps the price's own currency in the project locale", () => {
    expect(plain(formatPrice(1500, "JPY"))).toBe("1.500 ¥");
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
