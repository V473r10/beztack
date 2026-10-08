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
    PlanChangeError: MockPlanChangeError,
    getRouterParam: vi.fn(),
    requireAdmin: vi.fn(),
    requireAuth: vi.fn(),
    retryFailedPendingPlanChange: vi.fn(),
  };
});

vi.mock("h3", () => ({
  createError(input: { data?: unknown; statusCode?: number; statusMessage?: string }) {
    return Object.assign(new Error(input.statusMessage ?? "Error"), input);
  },
  defineEventHandler(handler: unknown) {
    return handler;
  },
  getRouterParam: mocks.getRouterParam,
}));
vi.mock("@/lib/payments", () => ({ ensurePaymentProvider: vi.fn() }));
vi.mock("@/server/utils/membership", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/server/utils/require-auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/server/utils/pending-plan-change-ledger", () => ({
  createDbPendingPlanChangeLedger: () => ({ requeueFailedPendingPlanChange: vi.fn() }),
}));
vi.mock("@/server/utils/pending-plan-change-provider", () => ({
  createPendingPlanChangeProviderPort: () => ({ applyPlanChange: vi.fn() }),
}));
vi.mock("@/server/utils/subscription-projection", () => ({
  createDbPendingPlanChangeActivationStore: () => Promise.resolve({}),
}));
vi.mock("@/server/utils/plan-change", () => ({
  PlanChangeError: mocks.PlanChangeError,
  retryFailedPendingPlanChange: mocks.retryFailedPendingPlanChange,
}));

async function loadHandler() {
  return (await import("../routes/api/auth/admin/plan-changes/[id]/retry.post")).default as (
    event: unknown,
  ) => Promise<unknown>;
}

describe("POST /api/auth/admin/plan-changes/:id/retry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue(undefined);
    mocks.requireAuth.mockResolvedValue({
      user: { id: "admin_1", email: "admin@example.com" },
      session: {},
    });
    mocks.getRouterParam.mockReturnValue("ppc_1");
  });

  it("retries the change as the App admin and says what happened", async () => {
    mocks.retryFailedPendingPlanChange.mockResolvedValue({
      action: "activated",
      pendingPlanChange: { id: "ppc_1", status: "activated" },
    });

    const response = await (await loadHandler())({});

    expect(mocks.retryFailedPendingPlanChange).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: {
          email: "admin@example.com",
          isAppAdmin: true,
          isBillingManager: false,
          userId: "admin_1",
        },
        pendingPlanChangeId: "ppc_1",
      }),
    );
    expect(response).toEqual({
      action: "activated",
      pendingPlanChange: { id: "ppc_1", status: "activated" },
    });
  });

  it("refuses anyone who is not an App admin before touching anything", async () => {
    mocks.requireAdmin.mockRejectedValue(
      Object.assign(new Error("App admin access required"), { statusCode: 403 }),
    );

    await expect((await loadHandler())({})).rejects.toMatchObject({ statusCode: 403 });
    expect(mocks.retryFailedPendingPlanChange).not.toHaveBeenCalled();
  });

  it("answers 409 with its code when the change cannot be retried", async () => {
    mocks.retryFailedPendingPlanChange.mockRejectedValue(
      new mocks.PlanChangeError("not_retryable", "Not retryable", 409),
    );

    await expect((await loadHandler())({})).rejects.toMatchObject({
      data: { code: "not_retryable" },
      statusCode: 409,
    });
  });
});
