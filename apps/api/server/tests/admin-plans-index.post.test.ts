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

  it("rejects a price that is not an integer of minor units", async () => {
    mocks.readBody.mockResolvedValue({ displayName: "Pro", price: 9.99, interval: "month" });
    const handler = await loadHandler();

    const error = await captureError(handler({}));

    expect(error).toBeDefined();
    expect(mocks.createProduct).not.toHaveBeenCalled();
  });

  it.each([
    { name: "an unknown currency", body: { currency: "XYZ" } },
    { name: "a currency that is not a 3-letter code", body: { currency: "dollars" } },
    { name: "an empty currency", body: { currency: "" } },
    { name: "a price above the 32-bit column", body: { price: 2_147_483_648 } },
  ])("rejects $name before calling the provider", async ({ body }) => {
    mocks.readBody.mockResolvedValue({
      displayName: "Pro",
      price: 100,
      interval: "month",
      ...body,
    });
    const handler = await loadHandler();

    const error = await captureError(handler({}));

    expect(error).toBeDefined();
    expect(mocks.createProduct).not.toHaveBeenCalled();
    expect(mocks.insertReturning).not.toHaveBeenCalled();
  });

  it("stores the currency in upper case", async () => {
    mocks.readBody.mockResolvedValue({
      displayName: "Pro",
      price: 100,
      interval: "month",
      currency: " usd ",
    });
    const handler = await loadHandler();

    await handler({});

    expect(mocks.createProduct).toHaveBeenCalledWith(
      expect.objectContaining({ price: { amount: 100, currency: "USD" } }),
    );
  });

  it("accepts the largest price the column holds", async () => {
    mocks.readBody.mockResolvedValue({
      displayName: "Pro",
      price: 2_147_483_647,
      interval: "month",
    });
    const handler = await loadHandler();

    await handler({});

    expect(mocks.createProduct).toHaveBeenCalledTimes(1);
  });

  it("creates a yearly plan on Polar", async () => {
    mocks.readBody.mockResolvedValue({ displayName: "Pro", price: 100, interval: "year" });
    const handler = await loadHandler();

    await handler({});

    expect(mocks.createProduct).toHaveBeenCalledWith(
      expect.objectContaining({ interval: "year", intervalCount: 1 }),
    );
  });
});
