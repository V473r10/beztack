import type { PaymentProviderAdapter, Subscription } from "@beztack/payments";
import { describe, expect, it, vi } from "vitest";
import { resolveCurrentBillingAmount } from "./billing-amount-resolver.js";

function mockSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: "sub_123",
    status: "active",
    productId: "plan_basic",
    customerId: "user_1",
    metadata: {},
    ...overrides,
  };
}

function mockProvider(
  product: { amount: number; currency: string; interval: string } | null = null
): PaymentProviderAdapter {
  return {
    provider: "mercadopago",
    getProduct: vi.fn().mockResolvedValue(
      product
        ? {
            id: "plan_basic",
            name: "Basic",
            type: "plan" as const,
            price: { amount: product.amount, currency: product.currency },
            interval: product.interval,
            intervalCount: 1,
          }
        : null
    ),
  } as unknown as PaymentProviderAdapter;
}

describe("resolveCurrentBillingAmount", () => {
  it("returns metadata billing amount when present and > 0", async () => {
    const sub = mockSubscription({
      metadata: {
        billingAmount: 350,
        billingCurrency: "UYU",
        billingInterval: "month",
      },
    });
    const provider = mockProvider();

    const result = await resolveCurrentBillingAmount(sub, provider);

    expect(result).toEqual({ amount: 350, currency: "UYU", interval: "month" });
    expect(provider.getProduct).not.toHaveBeenCalled();
  });

  it("falls back to provider.getProduct when metadata billing amount is 0", async () => {
    const sub = mockSubscription({
      productId: "plan_basic",
      metadata: { billingAmount: 0 },
    });
    const provider = mockProvider({
      amount: 350,
      currency: "UYU",
      interval: "month",
    });

    const result = await resolveCurrentBillingAmount(sub, provider);

    expect(result).toEqual({ amount: 350, currency: "UYU", interval: "month" });
    expect(provider.getProduct).toHaveBeenCalledWith("plan_basic");
  });

  it("falls back to provider.getProduct when metadata billing amount is missing", async () => {
    const sub = mockSubscription({
      productId: "plan_basic",
      metadata: {},
    });
    const provider = mockProvider({
      amount: 350,
      currency: "UYU",
      interval: "month",
    });

    const result = await resolveCurrentBillingAmount(sub, provider);

    expect(result).toEqual({ amount: 350, currency: "UYU", interval: "month" });
  });

  it("returns 0 when both metadata and product lookup fail", async () => {
    const sub = mockSubscription({
      productId: "",
      metadata: {},
    });
    const provider = mockProvider(null);

    const result = await resolveCurrentBillingAmount(sub, provider);

    expect(result.amount).toBe(0);
  });

  it("skips getProduct when productId is empty string", async () => {
    const sub = mockSubscription({
      productId: "",
      metadata: {},
    });
    const provider = mockProvider();

    await resolveCurrentBillingAmount(sub, provider);

    expect(provider.getProduct).not.toHaveBeenCalled();
  });
});
