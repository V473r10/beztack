/**
 * The catalog plans the pricing page lists next to the provider's products,
 * against a real Postgres. Runs when TEST_DATABASE_URL names a throwaway
 * database whose name ends in `_test` (the schema is dropped and rebuilt from
 * the real migrations); skipped otherwise, except on CI, where it must run.
 */
import { resolve } from "node:path";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

if (process.env.CI && !TEST_DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL is required on CI for the catalog products tests");
}

const MIGRATIONS_FOLDER = resolve(import.meta.dirname, "../../../../packages/db/drizzle");

type Modules = {
  dbModule: typeof import("@beztack/db");
  catalog: typeof import("../../lib/payments/catalog-mp");
};

function assertThrowawayDatabase(url: string): void {
  const name = new URL(url).pathname.replace(/^\//, "");
  if (!name.endsWith("_test")) {
    throw new Error(`Refusing to reset "${name}": TEST_DATABASE_URL must name a *_test database`);
  }
}

function planRow(overrides: Record<string, unknown>) {
  return {
    id: "polar_free_month",
    provider: "polar",
    providerPlanId: null,
    canonicalTierId: "free",
    displayName: "Free",
    description: "For evaluation",
    features: ["basic_dashboard"],
    limits: { users: 1 },
    permissions: ["dashboard.read"],
    price: 0,
    currency: "USD",
    interval: "month",
    displayOrder: 0,
    visible: true,
    status: "active",
    ...overrides,
  };
}

describe.skipIf(!TEST_DATABASE_URL)("Catalog products on Postgres", () => {
  let modules: Modules;

  beforeAll(async () => {
    const url = TEST_DATABASE_URL as string;
    assertThrowawayDatabase(url);
    // @beztack/db opens its client from DATABASE_URL when first imported.
    process.env.DATABASE_URL = url;
    const [dbModule, catalog, { migrate }] = await Promise.all([
      import("@beztack/db"),
      import("../../lib/payments/catalog-mp"),
      import("drizzle-orm/postgres-js/migrator"),
    ]);
    modules = { dbModule, catalog };

    await dbModule.db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
    await dbModule.db.execute(sql`DROP SCHEMA public CASCADE`);
    await dbModule.db.execute(sql`CREATE SCHEMA public`);
    await migrate(dbModule.db, { migrationsFolder: MIGRATIONS_FOLDER });
  });

  afterAll(async () => {
    await modules?.dbModule.db.$client.end();
  });

  beforeEach(async () => {
    const { db, plan } = modules.dbModule;
    await db.delete(plan);
    await db.insert(plan).values([
      planRow({}),
      planRow({
        id: "polar_pro_month",
        providerPlanId: "prod_pro_month",
        canonicalTierId: "pro",
        displayName: "Pro",
        price: 2900,
        displayOrder: 2,
      }),
      planRow({
        id: "polar_basic_month",
        canonicalTierId: "basic",
        displayName: "Basic",
        price: 900,
        displayOrder: 1,
      }),
      planRow({ id: "polar_hidden_month", canonicalTierId: "beta", visible: false }),
      planRow({ id: "mercadopago_free_month", provider: "mercadopago" }),
    ]);
  });

  it("lists the visible plans of the provider that have no product there, in display order", async () => {
    const products = await modules.catalog.getCatalogOnlyProducts("polar");

    expect(products.map((product) => [product.id, product.price])).toEqual([
      ["polar_free_month", { amount: 0, currency: "USD" }],
      ["polar_basic_month", { amount: 900, currency: "USD" }],
    ]);
    expect(products[0]?.metadata).toMatchObject({
      tier: "free",
      displayOrder: 0,
      catalogOnly: true,
      features: ["basic_dashboard"],
    });
  });

  it("marks a catalog plan without a remote product when the provider is down", async () => {
    const products = await modules.catalog.getCatalogProducts("polar");

    const byId = Object.fromEntries(products.map((product) => [product.id, product]));
    expect(byId.prod_pro_month?.metadata?.catalogOnly).toBe(false);
    expect(byId.polar_free_month?.metadata?.catalogOnly).toBe(true);
  });
});
