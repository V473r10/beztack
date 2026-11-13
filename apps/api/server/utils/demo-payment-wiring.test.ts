/**
 * The demo decorator as the API wires it: `ensurePaymentProvider` and
 * `getPaymentProvider` only return it when the real `DEMO_MODE` flag is on.
 */
import type { PaymentProviderAdapter } from "@beztack/payments";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  env: { DEMO_MODE: false, PAYMENT_PROVIDER: "polar" } as Record<string, unknown>,
  realAdapter: undefined as unknown as Record<string, ReturnType<typeof vi.fn> | string>,
  createDbStore: vi.fn(),
  storeGet: vi.fn(),
}));

vi.mock("@/env", () => ({ env: mocks.env }));
vi.mock("@beztack/payments", () => ({
  createPaymentProvider: vi.fn(async () => mocks.realAdapter),
  getPaymentProvider: vi.fn(() => mocks.realAdapter),
  resetPaymentProvider: vi.fn(),
  SubscriptionUpdateNotAppliedError: class extends Error {},
}));
vi.mock("./demo-subscription-store", () => ({
  createDbDemoSubscriptionStore: mocks.createDbStore,
}));

const DEMO_SUBSCRIPTION = { id: "demo_sub_pro", status: "active", productId: "p", customerId: "c" };

async function loadPayments() {
  vi.resetModules();
  return await import("@/lib/payments");
}

describe("payment provider wiring", () => {
  beforeEach(() => {
    mocks.realAdapter = {
      provider: "polar",
      getSubscription: vi.fn().mockResolvedValue({ id: "real", from: "provider" }),
    };
    mocks.storeGet.mockReset().mockResolvedValue(DEMO_SUBSCRIPTION);
    mocks.createDbStore.mockReset().mockReturnValue({ get: mocks.storeGet });
  });

  it("with DEMO_MODE=false there is no decorator: a demo_sub_ id reaches the real provider", async () => {
    mocks.env.DEMO_MODE = false;
    const { ensurePaymentProvider, getPaymentProvider } = await loadPayments();

    const adapter: PaymentProviderAdapter = await ensurePaymentProvider();

    expect(adapter).toBe(mocks.realAdapter);
    expect(getPaymentProvider()).toBe(mocks.realAdapter);
    await expect(adapter.getSubscription("demo_sub_pro")).resolves.toEqual({
      id: "real",
      from: "provider",
    });
    expect(mocks.createDbStore).not.toHaveBeenCalled();
    expect(mocks.storeGet).not.toHaveBeenCalled();
  });

  it("with DEMO_MODE=true a demo_sub_ id is answered by the demo store", async () => {
    mocks.env.DEMO_MODE = true;
    const { ensurePaymentProvider, getPaymentProvider } = await loadPayments();

    const adapter = await ensurePaymentProvider();

    expect(adapter).not.toBe(mocks.realAdapter);
    expect(getPaymentProvider()).toBe(adapter);
    await expect(adapter.getSubscription("demo_sub_pro")).resolves.toEqual(DEMO_SUBSCRIPTION);
    await expect(adapter.getSubscription("sub_other")).resolves.toEqual({
      id: "real",
      from: "provider",
    });
  });
});
