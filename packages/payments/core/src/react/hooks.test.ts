import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPricingTiers, fetchPricingTiers } from "./hooks.js";

function stubProducts(provider: string, amount: number, currency: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            provider,
            products: [
              {
                id: "prod_1",
                name: "Basic",
                type: "plan",
                price: { amount, currency },
                interval: "month",
                intervalCount: 1,
                metadata: { tier: "basic" },
              },
            ],
          }),
      }),
    ),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchPricingTiers", () => {
  // Products arrive as integer minor units whatever the provider (ADR 0007),
  // and the tier keeps them that way: formatting is the UI's job.
  it.each([
    { provider: "polar", currency: "USD", amount: 900 },
    { provider: "mercadopago", currency: "USD", amount: 900 },
    { provider: "mercadopago", currency: "UYU", amount: 39_000 },
    { provider: "mercadopago", currency: "JPY", amount: 900 },
    { provider: "polar", currency: "KWD", amount: 9000 },
  ])(
    "keeps a $currency price from $provider as $amount minor units",
    async ({ provider, currency, amount }) => {
      stubProducts(provider, amount, currency);

      const [tier] = await fetchPricingTiers("http://api.test");

      expect(tier?.price.monthly).toBe(amount);
      expect(tier?.monthly?.prices[0]).toMatchObject({
        priceAmount: amount,
        priceCurrency: currency,
      });
    },
  );
});

function product(tier: string, displayOrder: number | undefined, interval = "month") {
  return {
    id: `prod_${tier}_${interval}`,
    name: tier,
    type: "plan",
    price: { amount: 900, currency: "USD" },
    interval,
    intervalCount: 1,
    metadata: { tier, ...(displayOrder === undefined ? {} : { displayOrder }) },
  };
}

function stubProductList(products: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ products }) })),
  );
}

describe("fetchPricingTiers order", () => {
  it("orders tiers by the catalog displayOrder, not by the order the provider lists them", async () => {
    stubProductList([
      product("ultimate", 3),
      product("pro", 2),
      product("basic", 1),
      product("free", 0),
    ]);

    const tiers = await fetchPricingTiers("http://api.test");

    expect(tiers.map((tier) => tier.id)).toEqual(["free", "basic", "pro", "ultimate"]);
  });

  it("keeps the provider order between tiers that have the same displayOrder", async () => {
    stubProductList([product("zeta", 5), product("alpha", 5)]);

    const tiers = await fetchPricingTiers("http://api.test");

    expect(tiers.map((tier) => tier.id)).toEqual(["zeta", "alpha"]);
  });

  it("falls back to the known tier order when the catalog gave no displayOrder", async () => {
    stubProductList([product("ultimate", undefined), product("basic", undefined)]);

    const tiers = await fetchPricingTiers("http://api.test");

    expect(tiers.map((tier) => tier.id)).toEqual(["basic", "ultimate"]);
  });
});

describe("fetchPricingTiers catalog-only plans", () => {
  it("marks a tier whose only product has no remote counterpart", async () => {
    stubProductList([
      {
        ...product("free", 0),
        price: { amount: 0, currency: "USD" },
        metadata: { tier: "free", displayOrder: 0, catalogOnly: true },
      },
      product("pro", 2),
    ]);

    const tiers = await fetchPricingTiers("http://api.test");

    expect(tiers.find((tier) => tier.id === "free")?.catalogOnly).toBe(true);
    expect(tiers.find((tier) => tier.id === "pro")?.catalogOnly).toBeUndefined();
  });
});

describe("fetchPricingTiers names", () => {
  const named = (name: string, interval: "month" | "year", tier = "basic") => ({
    ...product(tier, 1, interval),
    name,
  });

  it("names a tier without the billing period when the provider names each product after it", async () => {
    stubProductList([named("Basic Yearly", "year"), named("Basic Monthly", "month")]);

    const [tier] = await fetchPricingTiers("http://api.test");

    expect(tier?.name).toBe("Basic");
  });

  it("keeps the name of a tier whose products share one name", async () => {
    stubProductList([named("Pro", "year", "pro"), named("Pro", "month", "pro")]);

    const [tier] = await fetchPricingTiers("http://api.test");

    expect(tier?.name).toBe("Pro");
  });

  it("keeps the name of a tier that has a single product", async () => {
    stubProductList([named("Basic Yearly", "year")]);

    const [tier] = await fetchPricingTiers("http://api.test");

    expect(tier?.name).toBe("Basic Yearly");
  });
});

describe("buildPricingTiers", () => {
  // The UI fetches the products once and derives the tiers from that one answer.
  it("groups a product list into tiers in catalog order, as fetchPricingTiers does", () => {
    const product = (tier: string, interval: "month" | "year", amount: number, order: number) => ({
      id: `prod_${tier}_${interval}`,
      name: `${tier} - ${interval}`,
      type: "plan" as const,
      price: { amount, currency: "USD" },
      interval,
      intervalCount: 1,
      metadata: { tier, displayOrder: order },
    });

    const tiers = buildPricingTiers([
      product("pro", "year", 29_000, 2),
      product("basic", "month", 900, 1),
      product("pro", "month", 2900, 2),
    ]);

    expect(tiers.map((tier) => tier.id)).toEqual(["basic", "pro"]);
    expect(tiers[1]?.price).toEqual({ monthly: 2900, yearly: 29_000 });
  });
});
