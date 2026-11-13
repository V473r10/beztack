import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPricingTiers } from "./hooks.js";

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
