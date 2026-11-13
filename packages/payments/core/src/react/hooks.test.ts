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
  // Products arrive as integer minor units whatever the provider (ADR 0007).
  it.each([
    { provider: "polar", currency: "USD", amount: 900, display: 9 },
    { provider: "mercadopago", currency: "USD", amount: 900, display: 9 },
    { provider: "mercadopago", currency: "UYU", amount: 39_000, display: 390 },
    { provider: "mercadopago", currency: "JPY", amount: 900, display: 900 },
    { provider: "polar", currency: "KWD", amount: 9000, display: 9 },
  ])(
    "shows a $currency price from $provider as $display",
    async ({ provider, currency, amount, display }) => {
      stubProducts(provider, amount, currency);

      const [tier] = await fetchPricingTiers("http://api.test");

      expect(tier?.price.monthly).toBe(display);
    },
  );
});
