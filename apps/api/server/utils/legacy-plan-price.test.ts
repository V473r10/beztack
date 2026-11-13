import { describe, expect, it } from "vitest";
import {
  legacyAmountFromPlanPrice,
  planPriceFromLegacyAmount,
  withLegacyPlanPrice,
  withLegacySnapshotPrice,
  withMinorSnapshotPrice,
} from "./legacy-plan-price";

describe("legacy plan price shim (until BZ-119)", () => {
  describe("legacyAmountFromPlanPrice", () => {
    it.each([
      // Polar already speaks minor units: no change.
      ["polar", "USD", 900, 900],
      // Mercado Pago speaks decimal major units.
      ["mercadopago", "UYU", 450_000, 4500],
      ["mercadopago", "USD", 999, 9.99],
      ["mercadopago", "JPY", 5000, 5000],
      ["mercadopago", "KWD", 12_500, 12.5],
      // A provider whose old unit is unknown is passed through.
      ["stripe", "USD", 2900, 2900],
    ])("%s %s: stored %i is read as %d", (provider, currency, stored, legacy) => {
      expect(legacyAmountFromPlanPrice(stored, currency, provider)).toBe(legacy);
    });
  });

  describe("planPriceFromLegacyAmount", () => {
    it.each([
      ["polar", "USD", 900, 900],
      ["mercadopago", "UYU", 4500, 450_000],
      ["mercadopago", "USD", 9.99, 999],
      ["mercadopago", "USD", 1.005, 101],
      ["mercadopago", "JPY", 5000, 5000],
      ["mercadopago", "KWD", 12.5, 12_500],
      ["stripe", "USD", 2900, 2900],
    ])("%s %s: written %d is stored as %i", (provider, currency, legacy, stored) => {
      expect(planPriceFromLegacyAmount(legacy, currency, provider)).toBe(stored);
    });

    it("is the inverse of legacyAmountFromPlanPrice", () => {
      for (const stored of [0, 1, 99, 450_000]) {
        const legacy = legacyAmountFromPlanPrice(stored, "UYU", "mercadopago");
        expect(planPriceFromLegacyAmount(legacy, "UYU", "mercadopago")).toBe(stored);
      }
    });
  });

  it("rewrites the price of a plan row and leaves the rest alone", () => {
    const row = { id: "mp_basic", provider: "mercadopago", currency: "UYU", price: 450_000 };
    expect(withLegacyPlanPrice(row)).toEqual({ ...row, price: 4500 });
    expect(row.price).toBe(450_000);
  });

  describe("snapshots of Pending Plan changes", () => {
    const snapshot = {
      id: "mp_basic",
      paymentProvider: "mercadopago",
      canonicalTierId: "basic",
      price: { amount: 450_000, currency: "UYU" },
    };

    it("reads the stored snapshot in the old unit", () => {
      expect(withLegacySnapshotPrice(snapshot)).toEqual({
        ...snapshot,
        price: { amount: 4500, currency: "UYU" },
      });
    });

    it("stores a snapshot built from old-unit catalog plans in minor units", () => {
      expect(
        withMinorSnapshotPrice({ ...snapshot, price: { amount: 4500, currency: "UYU" } }),
      ).toEqual(snapshot);
    });

    it("leaves a Polar snapshot as it is in both directions", () => {
      const polar = {
        ...snapshot,
        paymentProvider: "polar",
        price: { amount: 900, currency: "USD" },
      };
      expect(withLegacySnapshotPrice(polar)).toEqual(polar);
      expect(withMinorSnapshotPrice(polar)).toEqual(polar);
    });
  });
});
