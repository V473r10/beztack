import { describe, expect, it } from "vitest";
import { currencyDecimals, formatMinorUnits, majorToMinor, minorToMajor } from "./money.js";

describe("currencyDecimals", () => {
  it.each([
    ["USD", 2],
    ["UYU", 2],
    ["JPY", 0],
    ["CLP", 0],
    ["KWD", 3],
  ])("%s has %i decimals", (currency, decimals) => {
    expect(currencyDecimals(currency)).toBe(decimals);
  });

  it.each(["usd", "US", "DOLLAR", "", "ZZZ"])("rejects %j", (currency) => {
    expect(() => currencyDecimals(currency)).toThrow(/currency/i);
  });
});

describe("minorToMajor", () => {
  it.each([
    [900, "USD", 9],
    [1999, "USD", 19.99],
    [4950, "UYU", 49.5],
    [900, "JPY", 900],
    [12_500, "CLP", 12_500],
    [9000, "KWD", 9],
    [1234, "KWD", 1.234],
    [0, "USD", 0],
  ])("%i %s -> %d", (minor, currency, major) => {
    expect(minorToMajor(minor, currency)).toBe(major);
  });

  it.each([9.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53])(
    "rejects non-integer or unsafe amount %s",
    (minor) => {
      expect(() => minorToMajor(minor, "USD")).toThrow(/minor units/i);
    },
  );
});

describe("majorToMinor", () => {
  it.each([
    [9, "USD", 900],
    [19.99, "USD", 1999],
    [49.5, "UYU", 4950],
    [900, "JPY", 900],
    [12_500, "CLP", 12_500],
    [9, "KWD", 9000],
    [1.234, "KWD", 1234],
  ])("%d %s -> %i when the amount is exact", (major, currency, minor) => {
    expect(majorToMinor(major, currency, { rounding: "half-away-from-zero" })).toBe(minor);
  });

  it("does not lose a cent to binary floating point", () => {
    // 1.005 * 100 === 100.49999999999999 in IEEE 754.
    expect(majorToMinor(1.005, "USD", { rounding: "half-away-from-zero" })).toBe(101);
    // 0.29 * 100 === 28.999999999999996.
    expect(majorToMinor(0.29, "USD", { rounding: "floor" })).toBe(29);
  });

  describe("rounding is explicit", () => {
    it("rounds half away from zero", () => {
      expect(majorToMinor(10.125, "USD", { rounding: "half-away-from-zero" })).toBe(1013);
      expect(majorToMinor(10.124, "USD", { rounding: "half-away-from-zero" })).toBe(1012);
      expect(majorToMinor(-10.125, "USD", { rounding: "half-away-from-zero" })).toBe(-1013);
      expect(majorToMinor(0.5, "JPY", { rounding: "half-away-from-zero" })).toBe(1);
      expect(majorToMinor(1500.5, "CLP", { rounding: "half-away-from-zero" })).toBe(1501);
      expect(majorToMinor(1.2345, "KWD", { rounding: "half-away-from-zero" })).toBe(1235);
    });

    it("floors towards negative infinity", () => {
      expect(majorToMinor(10.129, "USD", { rounding: "floor" })).toBe(1012);
      expect(majorToMinor(-10.121, "USD", { rounding: "floor" })).toBe(-1013);
      expect(majorToMinor(999.9, "JPY", { rounding: "floor" })).toBe(999);
    });

    it("ceils towards positive infinity", () => {
      expect(majorToMinor(10.121, "USD", { rounding: "ceil" })).toBe(1013);
      expect(majorToMinor(-10.129, "USD", { rounding: "ceil" })).toBe(-1012);
      expect(majorToMinor(999.1, "JPY", { rounding: "ceil" })).toBe(1000);
    });

    it("leaves exact amounts alone in every mode", () => {
      for (const rounding of ["half-away-from-zero", "floor", "ceil"] as const) {
        expect(majorToMinor(9.99, "USD", { rounding })).toBe(999);
      }
    });
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])("rejects %s", (major) => {
    expect(() => majorToMinor(major, "USD", { rounding: "floor" })).toThrow(/amount/i);
  });

  it("rejects an amount whose minor units are not a safe integer", () => {
    expect(() => majorToMinor(1e20, "USD", { rounding: "floor" })).toThrow(/amount/i);
  });
});

describe("converting back and forth", () => {
  it.each([
    [1, "USD"],
    [999, "USD"],
    [123_456_789, "UYU"],
    [1, "JPY"],
    [250_000, "CLP"],
    [1, "KWD"],
    [9999, "KWD"],
  ])("%i %s survives minor -> major -> minor", (minor, currency) => {
    const major = minorToMajor(minor, currency);
    expect(majorToMinor(major, currency, { rounding: "half-away-from-zero" })).toBe(minor);
  });
});

describe("formatMinorUnits", () => {
  it("formats USD with two decimals in the given locale", () => {
    expect(formatMinorUnits(900, "USD", "en-US")).toBe("$9.00");
    expect(formatMinorUnits(2999, "USD", "en-US")).toBe("$29.99");
  });

  it("follows the chosen locale, not the currency", () => {
    expect(formatMinorUnits(123_456, "USD", "es-UY")).toMatch(/1\.234,56/);
    expect(formatMinorUnits(123_456, "USD", "en-US")).toBe("$1,234.56");
  });

  it("formats UYU", () => {
    expect(formatMinorUnits(4950, "UYU", "es-UY")).toMatch(/49,50/);
  });

  it("does not divide a zero-decimal currency", () => {
    expect(formatMinorUnits(900, "JPY", "en-US")).toBe("¥900");
    expect(formatMinorUnits(12_500, "CLP", "es-CL")).toMatch(/12\.500/);
  });

  it("shows three decimals for KWD", () => {
    // ICU separates the code from the number with a no-break space.
    expect(formatMinorUnits(9000, "KWD", "en-US")).toMatch(/^KWD\s9\.000$/);
    expect(formatMinorUnits(1234, "KWD", "en-US")).toMatch(/^KWD\s1\.234$/);
  });

  it("formats negative amounts", () => {
    expect(formatMinorUnits(-900, "USD", "en-US")).toBe("-$9.00");
  });

  it("rejects an amount that is not an integer", () => {
    expect(() => formatMinorUnits(9.5, "USD", "en-US")).toThrow(/minor units/i);
  });
});
