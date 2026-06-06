import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class MockPlanChangeError extends Error {
    code: string;
    statusCode: number;
    statusMessage: string;

    constructor(code: string, message: string, statusCode = 400) {
      super(message);
      this.name = "PlanChangeError";
      this.code = code;
      this.statusCode = statusCode;
      this.statusMessage = message;
    }
  }

  return {
    ensurePaymentProvider: vi.fn(),
    PlanChangeError: MockPlanChangeError,
    previewPlanChange: vi.fn(),
    readBody: vi.fn(),
    requireAuth: vi.fn(),
    env: {
      APP_ADMIN_EMAILS: "admin@example.com",
      MERCADO_PAGO_APPLICATION_ID: "mp_app_1",
      SUBSCRIPTION_MODE: "user" as "user" | "organization",
    },
  };
});

vi.mock("h3", () => ({
  createError(input: {
    data?: unknown;
    message?: string;
    statusCode?: number;
    statusMessage?: string;
  }) {
    return Object.assign(
      new Error(input.message ?? input.statusMessage ?? "Error"),
      input
    );
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
vi.mock("@/server/utils/plan-change", () => ({
  PlanChangeError: mocks.PlanChangeError,
  previewPlanChange: mocks.previewPlanChange,
}));
vi.mock("@/server/utils/subscription-discovery", () => ({
  discoverSubscriptionsFromDb: vi.fn(),
}));
vi.mock("@/server/utils/subscription-ownership", () => ({
  isSubscriptionOwnedByUser: vi.fn(),
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
    const handler = (
      await import("../routes/api/subscriptions/plan-change/preview.post")
    ).default as (event: unknown) => Promise<unknown>;

    const response = await handler({});

    expect(mocks.previewPlanChange).toHaveBeenCalledWith(
      expect.objectContaining({
        membershipTarget: { type: "user", id: "user_1" },
        actor: {
          email: "billing@example.com",
          isAppAdmin: false,
          userId: "user_1",
        },
        paymentProvider: "mercadopago",
        paymentIntegrationId: "mp_app_1",
        target: {
          tierId: "pro",
          billingCadence: "monthly",
        },
      })
    );
    expect(response).toEqual({
      provider: "mercadopago",
      planChangePreview: expectedPreview,
    });
  });
});
