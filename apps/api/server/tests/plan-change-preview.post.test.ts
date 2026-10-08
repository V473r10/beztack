import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensurePaymentProvider: vi.fn(),
  previewPlanChange: vi.fn(),
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
    previewPlanChange: mocks.previewPlanChange,
    classifyBillingCadence: actual.classifyBillingCadence,
    PlanChangeError: actual.PlanChangeError,
    requireSubscriptionBillingCadence: actual.requireSubscriptionBillingCadence,
  };
});
vi.mock("@/server/utils/subscription-discovery", () => ({
  discoverSubscriptionsFromDb: vi.fn(),
}));

describe("POST /api/subscriptions/plan-change/preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.env.MERCADO_PAGO_APPLICATION_ID = "mp_app_1";
    mocks.env.SUBSCRIPTION_MODE = "user";
    mocks.ensurePaymentProvider.mockResolvedValue({
      provider: "mercadopago",
      listSubscriptions: vi.fn(),
    });
    mocks.requireAuth.mockResolvedValue({
      user: {
        id: "user_1",
        email: "billing@example.com",
      },
      session: {},
    });
  });

  it("adapts Plan change vocabulary to the Plan change Module Interface", async () => {
    const expectedPreview = {
      kind: "plan-change-preview",
      direction: "upgrade",
    };
    mocks.readBody.mockResolvedValue({
      targetTierId: "pro",
      targetBillingCadence: "monthly",
    });
    mocks.previewPlanChange.mockResolvedValue(expectedPreview);
    const handler = (await import("../routes/api/subscriptions/plan-change/preview.post"))
      .default as (event: unknown) => Promise<unknown>;

    const response = await handler({});

    expect(mocks.previewPlanChange).toHaveBeenCalledWith(
      expect.objectContaining({
        membershipTarget: { type: "user", id: "user_1" },
        actor: {
          email: "billing@example.com",
          isAppAdmin: false,
          isBillingManager: false,
          userId: "user_1",
        },
        paymentProvider: "mercadopago",
        paymentIntegrationId: "mp_app_1",
        target: {
          tierId: "pro",
          billingCadence: "monthly",
        },
      }),
    );
    expect(response).toEqual({
      provider: "mercadopago",
      planChangePreview: expectedPreview,
    });
  });

  it.each([
    { role: "sudo", isAppAdmin: true },
    { role: "user,sudo", isAppAdmin: true },
    { role: "pseudo", isAppAdmin: false },
    { role: "sudoer", isAppAdmin: false },
    { role: "user,revoked-sudo", isAppAdmin: false },
    { role: ["pseudo"], isAppAdmin: false },
  ])("reads App admin from the exact role $role", async ({ role, isAppAdmin }) => {
    mocks.requireAuth.mockResolvedValue({
      user: { id: "user_1", email: "admin@example.com", role },
      session: {},
    });
    mocks.readBody.mockResolvedValue({ targetTierId: "pro", targetBillingCadence: "monthly" });
    mocks.previewPlanChange.mockResolvedValue({ kind: "plan-change-preview" });
    const handler = (await import("../routes/api/subscriptions/plan-change/preview.post"))
      .default as (event: unknown) => Promise<unknown>;

    await handler({});

    expect(mocks.previewPlanChange).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: expect.objectContaining({ isAppAdmin }),
      }),
    );
  });

  it("previews an App admin's Admin tier override without the Payment provider", async () => {
    mocks.requireAuth.mockResolvedValue({
      user: { id: "admin_1", email: "admin@example.com", role: "sudo" },
      session: {},
    });
    mocks.ensurePaymentProvider.mockRejectedValue(new Error("provider down"));
    mocks.readBody.mockResolvedValue({ targetTierId: "pro", targetBillingCadence: "monthly" });
    const overridePreview = { kind: "admin-tier-override-preview" };
    mocks.previewPlanChange.mockResolvedValue(overridePreview);
    const handler = (await import("../routes/api/subscriptions/plan-change/preview.post"))
      .default as (event: unknown) => Promise<unknown>;

    const response = await handler({});

    expect(mocks.ensurePaymentProvider).not.toHaveBeenCalled();
    expect(mocks.previewPlanChange).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: expect.objectContaining({ isAppAdmin: true }),
        paymentProvider: "mercadopago",
      }),
    );
    expect(response).toEqual({ provider: "mercadopago", planChangePreview: overridePreview });
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
    mocks.previewPlanChange.mockImplementation(
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
    const handler = (await import("../routes/api/subscriptions/plan-change/preview.post"))
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
