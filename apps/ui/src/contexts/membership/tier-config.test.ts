import { describe, expect, it } from "vitest";
import type { CatalogPlan, Product } from "./membership-types";
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
  // Product amounts are integer minor units whatever the provider (ADR 0007),
  // and the tier keeps them that way together with the currency.
  it.each([
    { currency: "USD", amount: 900 },
    { currency: "UYU", amount: 39_000 },
    { currency: "JPY", amount: 900 },
    { currency: "KWD", amount: 9000 },
  ])("keeps a $currency product price as $amount minor units", ({ currency, amount }) => {
    const tiers = buildTierConfigFromPlansAndProducts([product(amount, currency)], undefined);
    const basic = tiers.find((tier) => tier.id === "basic");

    expect(basic?.price.monthly).toBe(amount);
    expect(basic?.currency).toBe(currency);
  });

  it("keeps a catalog plan price as minor units with its currency", () => {
    const plan = {
      id: "plan_basic_year",
      canonicalTierId: "basic",
      displayName: "Basic",
      description: null,
      features: [],
      limits: {},
      permissions: [],
      price: { amount: 90_000, currency: "UYU" },
      frequency: 12,
      frequencyType: "months",
      initPoint: null,
      highlighted: false,
      soon: false,
      visible: true,
      displayOrder: 1,
    } satisfies CatalogPlan;

    const tiers = buildTierConfigFromPlansAndProducts([], [plan]);
    const basic = tiers.find((tier) => tier.id === "basic");

    expect(basic?.price.yearly).toBe(90_000);
    expect(basic?.currency).toBe("UYU");
  });
});
