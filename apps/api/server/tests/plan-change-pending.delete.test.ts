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
    cancelPendingPlanChange: vi.fn(),
    ensurePaymentProvider: vi.fn(),
    PlanChangeError: MockPlanChangeError,
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
  pendingPlanChange: {},
}));
vi.mock("@/env", () => ({ env: mocks.env }));
vi.mock("@/lib/payments", () => ({
  ensurePaymentProvider: mocks.ensurePaymentProvider,
}));
vi.mock("@/server/utils/membership", () => ({
  requireAuth: mocks.requireAuth,
}));
vi.mock("@/server/utils/plan-change", () => ({
  cancelPendingPlanChange: mocks.cancelPendingPlanChange,
  PlanChangeError: mocks.PlanChangeError,
}));
vi.mock("@/server/utils/subscription-discovery", () => ({
  discoverSubscriptionsFromDb: vi.fn(),
}));

describe("DELETE /api/subscriptions/plan-change/pending", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.env.MERCADO_PAGO_APPLICATION_ID = "mp_app_1";
    mocks.env.SUBSCRIPTION_MODE = "user";
    mocks.ensurePaymentProvider.mockResolvedValue({
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

  it("adapts Plan change vocabulary to Pending Plan change cancellation", async () => {
    const expectedCancellation = {
      changed: true,
      kind: "pending-plan-change-cancellation",
    };
    mocks.readBody.mockResolvedValue({});
    mocks.cancelPendingPlanChange.mockResolvedValue(expectedCancellation);
    const handler = (
      await import("../routes/api/subscriptions/plan-change/pending.delete")
    ).default as (event: unknown) => Promise<unknown>;

    const response = await handler({});

    expect(mocks.cancelPendingPlanChange).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: {
          email: "billing@example.com",
          isAppAdmin: false,
          userId: "user_1",
        },
        membershipTarget: { type: "user", id: "user_1" },
        paymentProvider: "mercadopago",
        paymentIntegrationId: "mp_app_1",
      })
    );
    expect(response).toEqual({
      provider: "mercadopago",
      pendingPlanChangeCancellation: expectedCancellation,
    });
  });
});
