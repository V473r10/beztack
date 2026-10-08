import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  acceptPlanChange: vi.fn(),
  applyAdminTierOverride: vi.fn(),
  ensurePaymentProvider: vi.fn(),
  readBody: vi.fn(),
  requireAuth: vi.fn(),
  env: {
    APP_ADMIN_EMAILS: "admin@example.com",
    MERCADO_PAGO_APPLICATION_ID: "mp_app_1",
    PAYMENT_PROVIDER: "mercadopago",
    SUBSCRIPTION_MODE: "user" as "user" | "organization",
  },
}));

vi.mock("h3", () => ({
  createError(input: {
    data?: unknown;
    message?: string;
    statusCode?: number;
    statusMessage?: string;
  }) {
    return Object.assign(new Error(input.message ?? input.statusMessage ?? "Error"), input);
  },
  defineEventHandler(handler: unknown) {
    return handler;
  },
  readBody: mocks.readBody,
}));

vi.mock("@beztack/db", () => ({
  db: {},
  member: {},
  organization: {},
  plan: {},
  user: {},
}));
vi.mock("@/env", () => ({ env: mocks.env }));
vi.mock("@/lib/payments", () => ({
  ensurePaymentProvider: mocks.ensurePaymentProvider,
}));
vi.mock("@/server/utils/membership", () => ({
  requireAuth: mocks.requireAuth,
}));
vi.mock("@/server/utils/plan-change", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/utils/plan-change")>();
  // The real Billing cadence classifier and its error, so a route test sees
  // the same rejection a request would.
  return {
    acceptPlanChange: mocks.acceptPlanChange,
    classifyBillingCadence: actual.classifyBillingCadence,
    PlanChangeError: actual.PlanChangeError,
    requireSubscriptionBillingCadence: actual.requireSubscriptionBillingCadence,
  };
});
vi.mock("@/server/utils/admin-tier-override", () => ({
  applyAdminTierOverride: mocks.applyAdminTierOverride,
}));
vi.mock("@/server/utils/subscription-discovery", () => ({
  discoverSubscriptionsFromDb: vi.fn(),
}));

describe("POST /api/subscriptions/plan-change/accept", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.env.MERCADO_PAGO_APPLICATION_ID = "mp_app_1";
    mocks.env.SUBSCRIPTION_MODE = "user";
    mocks.ensurePaymentProvider.mockResolvedValue({
      createSubscription: vi.fn(),
      listSubscriptions: vi.fn(),
      provider: "mercadopago",
    });
    mocks.requireAuth.mockResolvedValue({
      user: {
        id: "user_1",
        email: "billing@example.com",
      },
      session: {},
    });
  });

  it("adapts Plan change vocabulary to the Plan change acceptance Interface", async () => {
    const expectedAcceptance = {
      direction: "upgrade",
      kind: "plan-change-acceptance",
      membershipMoved: false,
    };
    mocks.readBody.mockResolvedValue({
      targetBillingCadence: "monthly",
      targetTierId: "pro",
    });
    mocks.acceptPlanChange.mockResolvedValue(expectedAcceptance);
    const handler = (await import("../routes/api/subscriptions/plan-change/accept.post"))
      .default as (event: unknown) => Promise<unknown>;

    const response = await handler({});

    expect(mocks.acceptPlanChange).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: {
          email: "billing@example.com",
          isAppAdmin: false,
          isBillingManager: false,
          userId: "user_1",
        },
        membershipTarget: { type: "user", id: "user_1" },
        paymentProvider: "mercadopago",
        paymentIntegrationId: "mp_app_1",
        target: {
          billingCadence: "monthly",
          tierId: "pro",
        },
      }),
    );
    expect(response).toEqual({
      provider: "mercadopago",
      planChangeAcceptance: expectedAcceptance,
    });
  });

  it("applies an App admin's Plan change as an Admin tier override, without the Payment provider", async () => {
    mocks.requireAuth.mockResolvedValue({
      user: { id: "admin_1", email: "admin@example.com", role: "sudo" },
      session: {},
    });
    mocks.ensurePaymentProvider.mockRejectedValue(new Error("provider down"));
    mocks.readBody.mockResolvedValue({
      targetBillingCadence: "monthly",
      targetPricingCatalogPlanId: "mercadopago_pro_month",
    });
    const target = { type: "user", id: "admin_1" };
    const override = { tier: "pro", billingCadence: "monthly" };
    mocks.applyAdminTierOverride.mockResolvedValue({
      kind: "admin-tier-override",
      changed: true,
      override,
      target,
    });
    const handler = (await import("../routes/api/subscriptions/plan-change/accept.post"))
      .default as (event: unknown) => Promise<unknown>;

    const response = await handler({});

    expect(mocks.ensurePaymentProvider).not.toHaveBeenCalled();
    expect(mocks.acceptPlanChange).not.toHaveBeenCalled();
    expect(mocks.applyAdminTierOverride).toHaveBeenCalledWith(
      expect.objectContaining({
        billingPeriod: "monthly",
        productId: "mercadopago_pro_month",
        provider: "mercadopago",
        sourceAction: "plan_change",
        subscriptionMode: "user",
        userId: "admin_1",
      }),
    );
    expect(response).toEqual({
      provider: "beztack",
      planChangeAcceptance: {
        kind: "admin-tier-override",
        changed: true,
        target,
        tier: "pro",
        billingCadence: "monthly",
        realSubscriptionsUnchanged: true,
      },
    });
  });

  it("refuses a Current Subscription with an unsupported Billing cadence with 409", async () => {
    mocks.ensurePaymentProvider.mockResolvedValue({
      createSubscription: vi.fn(),
      provider: "mercadopago",
      listSubscriptions: vi.fn().mockResolvedValue([
        {
          id: "sub_weekly",
          customerId: "user_1",
          productId: "prod_weekly",
          status: "active",
          metadata: { billingInterval: "week", billingFrequency: 1, userId: "user_1" },
        },
      ]),
    });
    mocks.readBody.mockResolvedValue({ targetTierId: "pro", targetBillingCadence: "monthly" });
    mocks.acceptPlanChange.mockImplementation(
      (input: {
        membershipTarget: unknown;
        paymentProvider: string;
        store: { findCurrentSubscription(input: unknown): Promise<unknown> };
      }) =>
        input.store.findCurrentSubscription({
          membershipTarget: input.membershipTarget,
          paymentProvider: input.paymentProvider,
        }),
    );
    const handler = (await import("../routes/api/subscriptions/plan-change/accept.post"))
      .default as (event: unknown) => Promise<unknown>;

    let caught: unknown;
    try {
      await handler({});
    } catch (error) {
      caught = error;
    }

    expect(caught).toMatchObject({
      statusCode: 409,
      data: { code: "unsupported_billing_cadence" },
    });
  });
});
