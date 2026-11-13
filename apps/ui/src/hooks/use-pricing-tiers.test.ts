import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/env", () => ({ env: { VITE_API_URL: "http://api.test" } }));

import {
  pricingTiersQueryOptions,
  productsQueryOptions,
  usePricingTiers,
} from "./use-pricing-tiers";

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

describe("Products on one page", () => {
  it("are requested once however many components need them as products or as tiers", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            provider: "polar",
            products: [product("pro", 2), product("free", 0, { catalogOnly: true })],
          }),
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient();
    const asProducts = new QueryObserver(client, productsQueryOptions());
    const asTiers = new QueryObserver(client, pricingTiersQueryOptions());
    const stops = [asProducts.subscribe(() => undefined), asTiers.subscribe(() => undefined)];

    await vi.waitFor(() => expect(asTiers.getCurrentResult().data).toBeDefined());
    for (const stop of stops) {
      stop();
    }

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(asProducts.getCurrentResult().data?.products).toHaveLength(2);
    expect(asTiers.getCurrentResult().data?.map((tier) => tier.id)).toEqual(["free", "pro"]);
  });
});
