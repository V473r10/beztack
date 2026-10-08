import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createProduct: vi.fn(),
  ensurePaymentProvider: vi.fn(),
  insertReturning: vi.fn(),
  readBody: vi.fn(),
  requireAdmin: vi.fn(),
}));

vi.mock("h3", () => ({
  createError(input: { data?: unknown; message?: string; statusCode?: number }) {
    return Object.assign(new Error(input.message ?? "Error"), input);
  },
  defineEventHandler(handler: unknown) {
    return handler;
  },
  readBody: mocks.readBody,
}));
vi.mock("@beztack/db", () => ({
  db: {
    insert: () => ({ values: () => ({ returning: mocks.insertReturning }) }),
  },
  plan: {},
}));
vi.mock("@/env", () => ({ env: { DEFAULT_CURRENCY: "UYU" } }));
vi.mock("@/lib/payments", () => ({ ensurePaymentProvider: mocks.ensurePaymentProvider }));
vi.mock("@/server/utils/require-auth", () => ({ requireAdmin: mocks.requireAdmin }));

async function loadHandler() {
  return (await import("../routes/api/auth/admin/plans/index.post")).default as (
    event: unknown,
  ) => Promise<unknown>;
}

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Expected the route to reject");
}

describe("POST /api/auth/admin/plans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ensurePaymentProvider.mockResolvedValue({
      provider: "polar",
      createProduct: mocks.createProduct,
    });
    mocks.createProduct.mockResolvedValue({ id: "prod_1" });
    mocks.insertReturning.mockResolvedValue([{ id: "plan_1" }]);
  });

  it.each([
    { interval: "week", intervalCount: 1 },
    { interval: "month", intervalCount: 2 },
  ])(
    "rejects the unsupported Billing cadence $interval x$intervalCount on Polar",
    async ({ interval, intervalCount }) => {
      mocks.readBody.mockResolvedValue({
        displayName: "Weekly",
        price: 10,
        interval,
        intervalCount,
      });
      const handler = await loadHandler();

      const error = await captureError(handler({}));

      expect(error).toMatchObject({
        statusCode: 400,
        data: { code: "unsupported_billing_cadence" },
      });
      expect(mocks.createProduct).not.toHaveBeenCalled();
    },
  );

  it("creates a yearly plan on Polar", async () => {
    mocks.readBody.mockResolvedValue({ displayName: "Pro", price: 100, interval: "year" });
    const handler = await loadHandler();

    await handler({});

    expect(mocks.createProduct).toHaveBeenCalledWith(
      expect.objectContaining({ interval: "year", intervalCount: 1 }),
    );
  });
});
