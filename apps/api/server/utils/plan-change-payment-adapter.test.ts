import {
  type PaymentProviderAdapter,
  type Subscription,
  SubscriptionUpdateNotAppliedError,
} from "@beztack/payments";
import { describe, expect, it, vi } from "vitest";
import type { PlanChangeCatalogPlan } from "./plan-change";
import { PlanChangeError } from "./plan-change";
import { createPlanChangePaymentAdapter } from "./plan-change-payment-adapter";

const BASIC: PlanChangeCatalogPlan = {
  id: "basic_month",
  paymentProvider: "polar",
  providerPlanId: "prod_basic",
  canonicalTierId: "basic",
  tierRank: 1,
  billingCadence: "monthly",
  price: { amount: 900, currency: "USD" },
};

const PRO: PlanChangeCatalogPlan = {
  id: "pro_month",
  paymentProvider: "polar",
  providerPlanId: "prod_pro",
  canonicalTierId: "pro",
  tierRank: 2,
  billingCadence: "monthly",
  price: { amount: 2900, currency: "USD" },
};

const UPGRADE_INPUT = {
  actor: { email: "visitor@example.com", isAppAdmin: false, isBillingManager: true, userId: "u_1" },
  currentPlan: BASIC,
  currentSubscriptionId: "sub_basic",
  // Basic paid 900, 15 of 30 days left: 450 of credit against Pro's 2900.
  firstPayment: { amount: 2450, credit: 450, currency: "USD", fullAmount: 2900 },
  membershipTarget: { type: "user" as const, id: "u_1" },
  targetPlan: PRO,
};

function subscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: "sub_basic",
    status: "active",
    productId: "prod_pro",
    customerId: "cus_1",
    ...overrides,
  };
}

function provider(options: {
  proratedUpgrade: boolean;
  updateSubscription?: PaymentProviderAdapter["updateSubscription"];
}) {
  const createSubscription = vi.fn(async () =>
    subscription({ id: "preapproval_1", metadata: { initPoint: "https://mp.example/pay" } }),
  );
  const updateSubscription = vi.fn(options.updateSubscription ?? (async () => subscription()));

  return {
    adapter: {
      provider: options.proratedUpgrade ? "polar" : "mercadopago",
      capabilities: { cadenceChange: true, proratedUpgrade: options.proratedUpgrade },
      createSubscription,
      updateSubscription,
    } as unknown as PaymentProviderAdapter,
    createSubscription,
    updateSubscription,
  };
}

describe("createPlanChangePaymentAdapter confirmUpgrade", () => {
  describe("when the provider upgrades in place (Polar)", () => {
    it("moves the current Subscription to the target product and lets the provider invoice the prorated difference", async () => {
      const { adapter, createSubscription, updateSubscription } = provider({
        proratedUpgrade: true,
      });

      await createPlanChangePaymentAdapter(adapter).confirmUpgrade(UPGRADE_INPUT);

      // `invoice`: the new product applies now and Polar charges the prorated
      // difference right away (https://polar.sh/docs/features/subscriptions/proration).
      expect(updateSubscription).toHaveBeenCalledExactlyOnceWith("sub_basic", {
        productId: "prod_pro",
        prorationBehavior: "invoice",
      });
      // It never opens a second Subscription, which is what could not work
      // for Polar (no productId, so its adapter threw).
      expect(createSubscription).not.toHaveBeenCalled();
    });

    it("reports the first Payment as pending, with no redirect, until the provider's webhook confirms it", async () => {
      const { adapter } = provider({ proratedUpgrade: true });

      const confirmation =
        await createPlanChangePaymentAdapter(adapter).confirmUpgrade(UPGRADE_INPUT);

      expect(confirmation).toEqual({
        firstPayment: { id: "sub_basic", status: "pending" },
        providerConfirmedPlanChangeId: "sub_basic",
        redirectUrl: undefined,
      });
    });

    it("refuses with a conflict when the provider kept the Subscription on the old product", async () => {
      const { adapter } = provider({
        proratedUpgrade: true,
        updateSubscription: async () => {
          throw new SubscriptionUpdateNotAppliedError("sub_basic", "Polar kept it on prod_basic");
        },
      });

      const error = await createPlanChangePaymentAdapter(adapter)
        .confirmUpgrade(UPGRADE_INPUT)
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(PlanChangeError);
      expect(error).toMatchObject({
        code: "provider_did_not_apply",
        statusCode: 409,
        message: "Polar kept it on prod_basic",
      });
    });

    it("lets any other provider failure through untouched", async () => {
      const failure = new Error("Polar is down");
      const { adapter } = provider({
        proratedUpgrade: true,
        updateSubscription: async () => {
          throw failure;
        },
      });

      await expect(
        createPlanChangePaymentAdapter(adapter).confirmUpgrade(UPGRADE_INPUT),
      ).rejects.toBe(failure);
    });
  });

  describe("when the provider cannot upgrade in place (Mercado Pago)", () => {
    it("opens a new Subscription for the prorated first Payment and redirects to pay it", async () => {
      const { adapter, createSubscription, updateSubscription } = provider({
        proratedUpgrade: false,
      });

      const confirmation =
        await createPlanChangePaymentAdapter(adapter).confirmUpgrade(UPGRADE_INPUT);

      expect(createSubscription).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          customPlan: expect.objectContaining({ amount: 2450, currency: "USD", interval: "month" }),
        }),
      );
      expect(updateSubscription).not.toHaveBeenCalled();
      expect(confirmation).toEqual({
        firstPayment: { id: "preapproval_1", status: "pending" },
        providerConfirmedPlanChangeId: "preapproval_1",
        redirectUrl: "https://mp.example/pay",
      });
    });
  });
});
