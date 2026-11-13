import {
  isSubscriptionUpdateNotAppliedError,
  type PaymentProviderAdapter,
  type Subscription,
  SubscriptionUpdateNotAppliedError,
} from "@beztack/payments";
import { describe, expect, it, vi } from "vitest";
import {
  type DemoSubscriptionStore,
  withDemoSubscriptions,
} from "./demo-payment-provider";

const DEMO_SUBSCRIPTION: Subscription = {
  id: "demo_sub_pro",
  status: "active",
  productId: "polar_pro_month_product",
  customerId: "demo_customer",
  metadata: { tier: "pro", billingAmount: 2900, billingCurrency: "USD" },
};

const REAL_SUBSCRIPTION: Subscription = {
  id: "sub_real_1",
  status: "active",
  productId: "real_product",
  customerId: "cust_1",
};

function createRealAdapter() {
  return {
    provider: "polar",
    capabilities: { cadenceChange: true },
    getSubscription: vi.fn().mockResolvedValue(REAL_SUBSCRIPTION),
    updateSubscription: vi.fn().mockResolvedValue(REAL_SUBSCRIPTION),
    cancelSubscription: vi.fn().mockResolvedValue(REAL_SUBSCRIPTION),
    listSubscriptions: vi.fn().mockResolvedValue([REAL_SUBSCRIPTION]),
    getProduct: vi.fn().mockResolvedValue(null),
  } as unknown as PaymentProviderAdapter & {
    getSubscription: ReturnType<typeof vi.fn>;
    updateSubscription: ReturnType<typeof vi.fn>;
    cancelSubscription: ReturnType<typeof vi.fn>;
    listSubscriptions: ReturnType<typeof vi.fn>;
    getProduct: ReturnType<typeof vi.fn>;
  };
}

function createStore(): DemoSubscriptionStore & {
  get: ReturnType<typeof vi.fn>;
  switchProduct: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
} {
  return {
    get: vi.fn(async (id: string) => (id === "demo_sub_pro" ? DEMO_SUBSCRIPTION : null)),
    switchProduct: vi.fn(async (_id: string, productId: string) => ({
      ...DEMO_SUBSCRIPTION,
      productId,
    })),
    cancel: vi.fn(async () => ({ ...DEMO_SUBSCRIPTION, status: "canceled" as const })),
  };
}

describe("withDemoSubscriptions without DEMO_MODE", () => {
  it.each([false, undefined, "true", 1])(
    "returns the real adapter untouched when demoMode is %s",
    async (demoMode) => {
      const real = createRealAdapter();
      const store = createStore();

      const adapter = withDemoSubscriptions(real, {
        demoMode: demoMode as boolean,
        store: () => store,
      });

      expect(adapter).toBe(real);
      expect(store.get).not.toHaveBeenCalled();
    },
  );

  it("never builds the store, so no demo code runs", () => {
    const createStoreSpy = vi.fn(createStore);

    withDemoSubscriptions(createRealAdapter(), { demoMode: false, store: createStoreSpy });

    expect(createStoreSpy).not.toHaveBeenCalled();
  });

  it("sends a demo_sub_ id to the real provider", async () => {
    const real = createRealAdapter();
    const adapter = withDemoSubscriptions(real, { demoMode: false, store: createStore });

    await adapter.getSubscription("demo_sub_pro");
    await adapter.updateSubscription("demo_sub_pro", { productId: "p" });
    await adapter.cancelSubscription("demo_sub_pro", true);

    expect(real.getSubscription).toHaveBeenCalledWith("demo_sub_pro");
    expect(real.updateSubscription).toHaveBeenCalledWith("demo_sub_pro", { productId: "p" });
    expect(real.cancelSubscription).toHaveBeenCalledWith("demo_sub_pro", true);
  });
});

describe("withDemoSubscriptions with DEMO_MODE=true", () => {
  function demoAdapter() {
    const real = createRealAdapter();
    const store = createStore();
    const adapter = withDemoSubscriptions(real, { demoMode: true, store: () => store });
    return { real, store, adapter };
  }

  it("reads a demo_sub_ Subscription from the demo store, not the provider", async () => {
    const { real, adapter } = demoAdapter();

    await expect(adapter.getSubscription("demo_sub_pro")).resolves.toEqual(DEMO_SUBSCRIPTION);
    expect(real.getSubscription).not.toHaveBeenCalled();
  });

  it("answers null for a demo_sub_ id the demo does not know, without asking the provider", async () => {
    const { real, adapter } = demoAdapter();

    await expect(adapter.getSubscription("demo_sub_unknown")).resolves.toBeNull();
    expect(real.getSubscription).not.toHaveBeenCalled();
  });

  it("moves a demo Subscription to another product (Pending Plan change activation)", async () => {
    const { real, store, adapter } = demoAdapter();

    const updated = await adapter.updateSubscription("demo_sub_pro", {
      productId: "polar_basic_month_product",
      prorationBehavior: "prorate",
    });

    expect(store.switchProduct).toHaveBeenCalledWith("demo_sub_pro", "polar_basic_month_product");
    expect(updated.productId).toBe("polar_basic_month_product");
    expect(real.updateSubscription).not.toHaveBeenCalled();
  });

  it("reports a product the demo catalog lacks as not applied", async () => {
    const { store, adapter } = demoAdapter();
    store.switchProduct.mockRejectedValue(
      new SubscriptionUpdateNotAppliedError("demo_sub_pro", "unknown product"),
    );

    const attempt = adapter.updateSubscription("demo_sub_pro", { productId: "missing" });

    await expect(attempt).rejects.toSatisfy(isSubscriptionUpdateNotAppliedError);
  });

  it("cancels a demo Subscription in the store", async () => {
    const { real, store, adapter } = demoAdapter();

    const canceled = await adapter.cancelSubscription("demo_sub_pro", true);

    expect(store.cancel).toHaveBeenCalledWith("demo_sub_pro", true);
    expect(canceled.status).toBe("canceled");
    expect(real.cancelSubscription).not.toHaveBeenCalled();
  });

  it("cancels at period end through updateSubscription", async () => {
    const { store, adapter } = demoAdapter();

    await adapter.updateSubscription("demo_sub_pro", { cancelAtPeriodEnd: true });

    expect(store.cancel).toHaveBeenCalledWith("demo_sub_pro", false);
  });

  it("refuses an update the demo cannot apply instead of pretending it did", async () => {
    const { adapter } = demoAdapter();

    await expect(adapter.updateSubscription("demo_sub_pro", { status: "pause" })).rejects.toSatisfy(
      isSubscriptionUpdateNotAppliedError,
    );
  });

  it("delegates every other Subscription id to the real provider", async () => {
    const { real, store, adapter } = demoAdapter();

    await expect(adapter.getSubscription("sub_real_1")).resolves.toEqual(REAL_SUBSCRIPTION);
    await adapter.updateSubscription("sub_real_1", { productId: "p" });
    await adapter.cancelSubscription("sub_real_1");

    expect(real.getSubscription).toHaveBeenCalledWith("sub_real_1");
    expect(real.updateSubscription).toHaveBeenCalledWith("sub_real_1", { productId: "p" });
    expect(real.cancelSubscription).toHaveBeenCalledWith("sub_real_1");
    expect(store.get).not.toHaveBeenCalled();
  });

  it("delegates all other operations and keeps the provider identity", async () => {
    const { real, adapter } = demoAdapter();

    await adapter.listSubscriptions({ customerId: "u1" });
    await adapter.getProduct("p1");

    expect(adapter.provider).toBe("polar");
    expect(adapter.capabilities).toEqual({ cadenceChange: true });
    expect(real.listSubscriptions).toHaveBeenCalledWith({ customerId: "u1" });
    expect(real.getProduct).toHaveBeenCalledWith("p1");
  });
});
