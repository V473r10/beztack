import { describe, expect, it } from "vitest";
import type { PricingTier } from "@/types/pricing";
import { resolvePricingAction, resolveTierProductId } from "./pricing-actions";

const PRO = {
  id: "pro",
  name: "Pro",
  description: "For teams",
  price: { monthly: 2900, yearly: 29_000 },
  monthly: { id: "prod_pro_month" },
  yearly: { id: "prod_pro_year" },
} as PricingTier;

const FREE = {
  id: "free",
  name: "Free",
  description: "For evaluation",
  price: { monthly: 0, yearly: 0 },
  catalogOnly: true,
} as PricingTier;

describe("resolveTierProductId", () => {
  it("picks the product of the chosen Billing period, never the tier id", () => {
    expect(resolveTierProductId(PRO, "monthly")).toBe("prod_pro_month");
    expect(resolveTierProductId(PRO, "yearly")).toBe("prod_pro_year");
  });

  it("has no product for a plan with none for that period", () => {
    expect(resolveTierProductId({ ...PRO, yearly: undefined }, "yearly")).toBeUndefined();
  });

  it("has no product for a plan that lives in the catalog only", () => {
    expect(resolveTierProductId(FREE, "monthly")).toBeUndefined();
  });
});

describe("resolvePricingAction", () => {
  it("opens the Plan change dialog when the visitor has a Subscription", () => {
    expect(
      resolvePricingAction({ billingPeriod: "monthly", changesPlan: true, tier: PRO }),
    ).toEqual({ kind: "plan-change", tier: PRO });
  });

  it("starts a checkout of the product for the chosen period when there is no Subscription", () => {
    expect(
      resolvePricingAction({ billingPeriod: "monthly", changesPlan: false, tier: PRO }),
    ).toEqual({ kind: "checkout", productId: "prod_pro_month" });
    expect(
      resolvePricingAction({ billingPeriod: "yearly", changesPlan: false, tier: PRO }),
    ).toEqual({ kind: "checkout", productId: "prod_pro_year" });
  });

  it("does nothing for a plan that cannot be bought for the chosen period", () => {
    expect(
      resolvePricingAction({
        billingPeriod: "yearly",
        changesPlan: false,
        tier: { ...PRO, yearly: undefined },
      }),
    ).toEqual({ kind: "none" });
    expect(
      resolvePricingAction({
        billingPeriod: "yearly",
        changesPlan: true,
        tier: { ...PRO, yearly: undefined },
      }),
    ).toEqual({ kind: "none" });
  });

  it("does nothing for the Free plan", () => {
    expect(
      resolvePricingAction({ billingPeriod: "monthly", changesPlan: true, tier: FREE }),
    ).toEqual({
      kind: "none",
    });
  });
});
