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
  product: { amount: number; currency: string; interval: string } | null = null,
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
        : null,
    ),
  } as unknown as PaymentProviderAdapter;
}

// Deliberately not the currency used by any fixture: a result carrying it
// proves the project default was used, not the Subscription's own currency.
const PROJECT_CURRENCY = "EUR";

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

    const result = await resolveCurrentBillingAmount(sub, provider, PROJECT_CURRENCY);

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

    const result = await resolveCurrentBillingAmount(sub, provider, PROJECT_CURRENCY);

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

    const result = await resolveCurrentBillingAmount(sub, provider, PROJECT_CURRENCY);

    expect(result).toEqual({ amount: 350, currency: "UYU", interval: "month" });
  });

  it("returns 0 when both metadata and product lookup fail", async () => {
    const sub = mockSubscription({
      productId: "",
      metadata: {},
    });
    const provider = mockProvider(null);

    const result = await resolveCurrentBillingAmount(sub, provider, PROJECT_CURRENCY);

    expect(result.amount).toBe(0);
  });

  it("skips getProduct when productId is empty string", async () => {
    const sub = mockSubscription({
      productId: "",
      metadata: {},
    });
    const provider = mockProvider();

    await resolveCurrentBillingAmount(sub, provider, PROJECT_CURRENCY);

    expect(provider.getProduct).not.toHaveBeenCalled();
  });

  describe("currency precedence", () => {
    it("keeps the Subscription's own currency over the project default", async () => {
      const sub = mockSubscription({
        metadata: { billingAmount: 350, billingCurrency: "UYU" },
      });

      const result = await resolveCurrentBillingAmount(sub, mockProvider(), PROJECT_CURRENCY);

      expect(result.currency).toBe("UYU");
    });

    it("keeps the product price currency over the project default", async () => {
      const sub = mockSubscription({ productId: "plan_basic", metadata: {} });
      const provider = mockProvider({ amount: 10, currency: "JPY", interval: "month" });

      const result = await resolveCurrentBillingAmount(sub, provider, PROJECT_CURRENCY);

      expect(result.currency).toBe("JPY");
    });

    it("uses the project default when the Subscription carries an amount but no currency", async () => {
      const sub = mockSubscription({ metadata: { billingAmount: 350 } });

      const result = await resolveCurrentBillingAmount(sub, mockProvider(), PROJECT_CURRENCY);

      expect(result).toEqual({ amount: 350, currency: PROJECT_CURRENCY, interval: "month" });
    });

    it("uses the project default when nothing carries a currency", async () => {
      const sub = mockSubscription({ productId: "", metadata: {} });

      const result = await resolveCurrentBillingAmount(sub, mockProvider(null), PROJECT_CURRENCY);

      expect(result.currency).toBe(PROJECT_CURRENCY);
    });

    it("ignores an empty currency string on the Subscription", async () => {
      const sub = mockSubscription({ metadata: { billingAmount: 350, billingCurrency: "" } });

      const result = await resolveCurrentBillingAmount(sub, mockProvider(), PROJECT_CURRENCY);

      expect(result.currency).toBe(PROJECT_CURRENCY);
    });
  });
});
