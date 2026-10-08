import { SubscriptionUpdateNotAppliedError } from "@beztack/payments";
import { describe, expect, it, vi } from "vitest";
import type { PlanChangeCatalogPlan } from "./plan-change";
import { createPendingPlanChangeProviderPort } from "./pending-plan-change-provider";

const TARGET_PLAN: PlanChangeCatalogPlan = {
  id: "plan_basic",
  paymentProvider: "mercadopago",
  providerPlanId: "mp_plan_basic",
  canonicalTierId: "basic",
  tierRank: 1,
  billingCadence: "monthly",
  price: { amount: 500, currency: "UYU" },
};

describe("createPendingPlanChangeProviderPort", () => {
  it("moves the Subscription to the target plan's provider product", async () => {
    const updateSubscription = vi.fn().mockResolvedValue({});
    const port = createPendingPlanChangeProviderPort(() => Promise.resolve({ updateSubscription }));

    await expect(
      port.applyPlanChange({ subscriptionId: "sub_1", targetPlan: TARGET_PLAN }),
    ).resolves.toEqual({ applied: true });
    expect(updateSubscription).toHaveBeenCalledWith("sub_1", {
      productId: "mp_plan_basic",
      prorationBehavior: "prorate",
    });
  });

  it("reports a change the provider ignored as not applied", async () => {
    const port = createPendingPlanChangeProviderPort(() =>
      Promise.resolve({
        updateSubscription: vi
          .fn()
          .mockRejectedValue(
            new SubscriptionUpdateNotAppliedError("sub_1", "kept charging 1000 instead of 500"),
          ),
      }),
    );

    await expect(
      port.applyPlanChange({ subscriptionId: "sub_1", targetPlan: TARGET_PLAN }),
    ).resolves.toEqual({ applied: false, reason: "kept charging 1000 instead of 500" });
  });

  it("rethrows other provider errors so the webhook is retried", async () => {
    const port = createPendingPlanChangeProviderPort(() =>
      Promise.resolve({ updateSubscription: vi.fn().mockRejectedValue(new Error("timeout")) }),
    );

    await expect(
      port.applyPlanChange({ subscriptionId: "sub_1", targetPlan: TARGET_PLAN }),
    ).rejects.toThrow("timeout");
  });
});
