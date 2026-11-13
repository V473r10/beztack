import { describe, expect, it } from "vitest";
// The module has no database dependency, unlike the `@beztack/db` entry point.
import { buildSeedPlans } from "../../../../packages/db/src/plan-catalog";

function priceOf(
  plans: ReturnType<typeof buildSeedPlans>,
  tier: string,
  interval: "month" | "year",
) {
  return plans.find((plan) => plan.canonicalTierId === tier && plan.interval === interval)?.price;
}

describe("the seeded plan catalog stores integer minor units (ADR 0007)", () => {
  it("Polar prices are US$ cents", () => {
    const plans = buildSeedPlans("polar", "USD");

    expect(priceOf(plans, "free", "month")).toBe(0);
    expect(priceOf(plans, "basic", "month")).toBe(900); // US$ 9.00
    expect(priceOf(plans, "basic", "year")).toBe(9000);
    expect(priceOf(plans, "pro", "month")).toBe(2900);
    expect(priceOf(plans, "ultimate", "year")).toBe(99_000);
    expect(new Set(plans.map((plan) => plan.currency))).toEqual(new Set(["USD"]));
  });

  it("Mercado Pago prices are the project currency's minor units", () => {
    // The demo amounts are 4500 / 8000 / 15000 units of the project currency.
    const uyu = buildSeedPlans("mercadopago", "UYU");
    expect(priceOf(uyu, "basic", "month")).toBe(450_000); // UYU 4500.00
    expect(priceOf(uyu, "ultimate", "month")).toBe(1_500_000);

    const jpy = buildSeedPlans("mercadopago", "JPY");
    expect(priceOf(jpy, "basic", "month")).toBe(4500); // JPY has no minor unit

    const kwd = buildSeedPlans("mercadopago", "KWD");
    expect(priceOf(kwd, "basic", "month")).toBe(4_500_000); // KWD 4500.000
  });

  it("every price is a safe integer", () => {
    for (const [provider, currency] of [
      ["polar", "USD"],
      ["mercadopago", "UYU"],
      ["mercadopago", "KWD"],
    ] as const) {
      for (const plan of buildSeedPlans(provider, currency)) {
        expect(Number.isSafeInteger(plan.price)).toBe(true);
      }
    }
  });
});
