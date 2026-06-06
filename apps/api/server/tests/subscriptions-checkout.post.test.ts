import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  applyAdminTierOverride: vi.fn(),
  ensurePaymentProvider: vi.fn(),
  isAppAdminActor: vi.fn(),
  readBody: vi.fn(),
  requireAuth: vi.fn(),
  env: {
    APP_ADMIN_EMAILS: "admin@example.com",
    PAYMENT_PROVIDER: "polar",
    PAYMENTS_CANCEL_URL: "",
    PAYMENTS_SUCCESS_URL: "",
    POLAR_CANCEL_URL: "",
    POLAR_SUCCESS_URL: "",
    SUBSCRIPTION_MODE: "user" as "user" | "organization",
  },
}));

vi.mock("h3", () => ({
  createError(input: { message?: string; statusMessage?: string }) {
    return new Error(input.message ?? input.statusMessage ?? "Error");
  },
  defineEventHandler(handler: unknown) {
    return handler;
  },
  readBody: mocks.readBody,
}));

vi.mock("@/env", () => ({ env: mocks.env }));
vi.mock("@/lib/payments", () => ({
  ensurePaymentProvider: mocks.ensurePaymentProvider,
}));
vi.mock("@/lib/payments/catalog", () => ({
  resolveProductByCanonicalPlan: vi.fn(),
}));
vi.mock("@/lib/payments/catalog-mp", () => ({
  enrichProductWithCatalog: vi.fn(),
}));
vi.mock("@/server/utils/admin-tier-override", () => ({
  applyAdminTierOverride: mocks.applyAdminTierOverride,
  isAppAdminActor: mocks.isAppAdminActor,
}));
vi.mock("@/server/utils/billing-amount-resolver", () => ({
  estimatePeriodEnd: vi.fn(),
  resolveCurrentBillingAmount: vi.fn(),
}));
vi.mock("@/server/utils/checkout-callback-urls", () => ({
  resolveCheckoutCallbackUrls: vi.fn(),
}));
vi.mock("@/server/utils/membership", () => ({
  requireAuth: mocks.requireAuth,
}));
vi.mock("@/server/utils/subscription-discovery", () => ({
  discoverSubscriptionsFromDb: vi.fn(),
}));
vi.mock("@/server/utils/subscription-ownership", () => ({
  isSubscriptionOwnedByUser: vi.fn(),
}));
describe("POST /api/subscriptions/checkout", () => {
  it("applies an Admin tier override before initializing the payment provider", async () => {
    const handler = (await import("../routes/api/subscriptions/checkout.post"))
      .default as (event: unknown) => Promise<unknown>;
    mocks.requireAuth.mockResolvedValue({
      user: {
        id: "admin_1",
        email: "admin@example.com",
        role: "sudo",
      },
      session: {},
    });
    mocks.readBody.mockResolvedValue({
      billingPeriod: "monthly",
      productId: "prod_pro_month",
    });
    mocks.isAppAdminActor.mockReturnValue(true);
    mocks.applyAdminTierOverride.mockResolvedValue({
      kind: "admin-tier-override",
      changed: true,
      target: { type: "user", id: "admin_1" },
      override: {
        tier: "pro",
        billingCadence: "monthly",
      },
    });

    const response = await handler({});

    expect(mocks.ensurePaymentProvider).not.toHaveBeenCalled();
    expect(mocks.applyAdminTierOverride).toHaveBeenCalledWith(
      expect.objectContaining({
        billingPeriod: "monthly",
        productId: "prod_pro_month",
        provider: "polar",
        sourceAction: "checkout",
        subscriptionMode: "user",
        userId: "admin_1",
      })
    );
    expect(response).toEqual({
      provider: "beztack",
      resultKind: "admin-tier-override",
      changed: true,
      adminTierOverride: {
        target: { type: "user", id: "admin_1" },
        tier: "pro",
        billingCadence: "monthly",
        realSubscriptionsUnchanged: true,
      },
    });
  });
});
