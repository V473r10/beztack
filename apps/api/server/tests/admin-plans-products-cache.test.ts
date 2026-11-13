import { beforeEach, describe, expect, it, vi } from "vitest";
import { invalidateProductsCache, readThroughProductsCache } from "@/server/utils/products-cache";

const mocks = vi.hoisted(() => ({
  body: {} as unknown,
  rows: [] as unknown[],
}));

// A drizzle-style query builder that resolves to `mocks.rows` wherever it is awaited.
function query() {
  const builder: Record<string, unknown> = {};
  for (const method of ["from", "where", "limit", "set", "values", "returning"]) {
    builder[method] = () => builder;
  }
  builder.then = (resolve: (rows: unknown[]) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve(mocks.rows).then(resolve, reject);
  return builder;
}

vi.mock("h3", () => ({
  createError(input: { message?: string; statusCode?: number }) {
    return Object.assign(new Error(input.message ?? "Error"), input);
  },
  defineEventHandler(handler: unknown) {
    return handler;
  },
  readBody: () => Promise.resolve(mocks.body),
}));
vi.mock("@beztack/db", () => ({
  db: { select: query, insert: query, update: query },
  plan: {},
}));
vi.mock("@/env", () => ({ env: { DEFAULT_CURRENCY: "USD" } }));
vi.mock("@/server/utils/require-auth", () => ({ requireAdmin: () => Promise.resolve() }));
vi.mock("@/lib/payments", () => ({
  ensurePaymentProvider: () =>
    Promise.resolve({
      provider: "polar",
      createProduct: () => Promise.resolve({ id: "prod_new" }),
      deleteProduct: () => Promise.resolve(),
      getProduct: () =>
        Promise.resolve({
          id: "prod_1",
          name: "Pro",
          price: { amount: 2900, currency: "USD" },
          interval: "month",
          intervalCount: 1,
        }),
      updateProduct: () => Promise.resolve(),
    }),
}));

const PLAN_ROW = {
  id: "plan_1",
  providerPlanId: null,
  displayName: "Pro",
  price: 2900,
  currency: "USD",
  interval: "month",
  intervalCount: 1,
};

const ROUTES = [
  {
    name: "create",
    load: () => import("../routes/api/auth/admin/plans/index.post"),
    body: { displayName: "Pro", price: 2900 },
  },
  {
    name: "patch",
    load: () => import("../routes/api/auth/admin/plans/[id].patch"),
    body: { displayName: "Pro+" },
  },
  {
    name: "delete",
    load: () => import("../routes/api/auth/admin/plans/[id].delete"),
    body: {},
  },
  {
    name: "sync (push)",
    load: () => import("../routes/api/auth/admin/plans/sync.post"),
    body: { planId: "plan_1", direction: "push-to-provider" },
  },
  {
    name: "sync (pull)",
    load: () => import("../routes/api/auth/admin/plans/sync.post"),
    body: { planId: "plan_1", direction: "pull-from-provider" },
    row: { ...PLAN_ROW, providerPlanId: "prod_1" },
  },
  {
    name: "import",
    load: () => import("../routes/api/auth/admin/plans/import.post"),
    body: { remoteProductId: "prod_1" },
  },
];

describe("admin plan changes and the Products cache", () => {
  beforeEach(() => {
    invalidateProductsCache();
  });

  it.each(ROUTES)("$name drops the cached Products response", async (route) => {
    mocks.body = route.body;
    mocks.rows = [route.row ?? PLAN_ROW];
    const handler = (await route.load()).default as (event: unknown) => Promise<unknown>;
    await readThroughProductsCache(() => Promise.resolve({ body: "cached", ttlMs: 60_000 }));

    await handler({ context: { params: { id: "plan_1" } } });

    const reload = vi.fn(() => Promise.resolve({ body: "fresh", ttlMs: 60_000 }));
    expect(await readThroughProductsCache(reload)).toBe("fresh");
  });
});
