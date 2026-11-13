import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/env", () => ({ env: { VITE_API_URL: "http://api.test" } }));

import { usePricingTiers } from "./use-pricing-tiers";

function product(tier: string, displayOrder: number, extra: Record<string, unknown> = {}) {
  return {
    id: `prod_${tier}`,
    name: tier,
    type: "plan",
    price: { amount: displayOrder * 1000, currency: "USD" },
    interval: "month",
    intervalCount: 1,
    metadata: { tier, displayOrder, ...extra },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Pricing tiers the pricing page lists", () => {
  it("come in catalog order with Free first, however the provider lists them", async () => {
    // Polar lists newest first: Ultimate before Basic, and the catalog-only Free last.
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              products: [
                product("ultimate", 3),
                product("pro", 2),
                product("basic", 1),
                product("free", 0, { catalogOnly: true }),
              ],
            }),
        }),
      ),
    );

    const tiers = await usePricingTiers();

    expect(tiers.map((tier) => tier.id)).toEqual(["free", "basic", "pro", "ultimate"]);
    expect(tiers.map((tier) => tier.catalogOnly ?? false)).toEqual([true, false, false, false]);
  });
});
