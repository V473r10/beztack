import { describe, expect, it } from "vitest";
import { priceInputToMinorUnits } from "./helpers";

describe("priceInputToMinorUnits", () => {
  it.each([
    { input: "9", currency: "USD", minor: 900 },
    { input: "9.99", currency: "USD", minor: 999 },
    { input: "390", currency: "UYU", minor: 39_000 },
    { input: "1500", currency: "JPY", minor: 1500 },
    { input: "1.5", currency: "KWD", minor: 1500 },
    { input: "0.29", currency: "usd", minor: 29 },
  ])("reads $input $currency as $minor minor units", ({ input, currency, minor }) => {
    expect(priceInputToMinorUnits(input, currency)).toBe(minor);
  });

  it.each(["", "abc", "0", "-5", "0.001"])("rejects %j as a price", (input) => {
    expect(priceInputToMinorUnits(input, "USD")).toBeNull();
  });

  it("rejects an unknown currency instead of guessing its decimals", () => {
    expect(priceInputToMinorUnits("9", "XXXX")).toBeNull();
    expect(priceInputToMinorUnits("9", "")).toBeNull();
  });
});
