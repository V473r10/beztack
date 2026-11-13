import { describe, expect, it } from "vitest";
import type { Product } from "./membership-types";
import { buildTierConfigFromPlansAndProducts } from "./tier-config";

function product(amount: number, currency: string): Product {
  return {
    id: "prod_1",
    name: "Basic",
    type: "plan",
    price: { amount, currency },
    interval: "month",
    intervalCount: 1,
    metadata: { tier: "basic" },
  } as Product;
}

describe("buildTierConfigFromPlansAndProducts", () => {
  // Product amounts are integer minor units whatever the provider (ADR 0007).
  it.each([
    { provider: "polar", currency: "USD", amount: 900, display: 9 },
    { provider: "mercadopago", currency: "USD", amount: 900, display: 9 },
    { provider: "mercadopago", currency: "UYU", amount: 39_000, display: 390 },
    { provider: "mercadopago", currency: "JPY", amount: 900, display: 900 },
    { provider: "polar", currency: "KWD", amount: 9000, display: 9 },
  ] as const)(
    "shows a $currency price from $provider as $display",
    ({ provider, currency, amount, display }) => {
      const tiers = buildTierConfigFromPlansAndProducts(
        [product(amount, currency)],
        undefined,
        provider,
      );

      expect(tiers.find((tier) => tier.id === "basic")?.price.monthly).toBe(display);
    },
  );
});
