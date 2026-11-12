/**
 * The demo seed against a real Postgres: idempotence, the rows the admin pages
 * read, and the reset guard. Runs when TEST_DATABASE_URL names a throwaway
 * database whose name ends in `_test` (the schema is dropped and rebuilt from
 * the real migrations); skipped otherwise, except on CI, where it must run.
 */
import { resolve } from "node:path";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { DemoSeedOptions } from "./demo-seed";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

if (process.env.CI && !TEST_DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL is required on CI for the demo seed tests");
}

const MIGRATIONS_FOLDER = resolve(import.meta.dirname, "../../../../packages/db/drizzle");

const OPTIONS: DemoSeedOptions = {
  provider: "polar",
  currency: "USD",
  adminEmail: "Admin@Demo.Beztack.Test",
  adminPasswordHash: "salt:hash-not-a-real-password",
  providerPlanIds: { polar_basic_month: "00000000-0000-4000-8000-000000000001" },
  now: new Date("2026-11-11T12:00:00.000Z"),
};

type Modules = {
  dbModule: typeof import("@beztack/db");
  seedModule: typeof import("./demo-seed");
};

function assertThrowawayDatabase(url: string): void {
  const name = new URL(url).pathname.replace(/^\//, "");
  if (!name.endsWith("_test")) {
    throw new Error(`Refusing to reset "${name}": TEST_DATABASE_URL must name a *_test database`);
  }
}

describe.skipIf(!TEST_DATABASE_URL)("Demo seed on Postgres", () => {
  let modules: Modules;

  beforeAll(async () => {
    const url = TEST_DATABASE_URL as string;
    assertThrowawayDatabase(url);
    // @beztack/db opens its client from DATABASE_URL when first imported.
    process.env.DATABASE_URL = url;
    const [dbModule, seedModule, { migrate }] = await Promise.all([
      import("@beztack/db"),
      import("./demo-seed"),
      import("drizzle-orm/postgres-js/migrator"),
    ]);
    modules = { dbModule, seedModule };

    await dbModule.db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
    await dbModule.db.execute(sql`DROP SCHEMA public CASCADE`);
    await dbModule.db.execute(sql`CREATE SCHEMA public`);
    await migrate(dbModule.db, { migrationsFolder: MIGRATIONS_FOLDER });
  });

  afterAll(async () => {
    await modules?.dbModule.db.$client.end();
  });

  beforeEach(async () => {
    await modules.seedModule.resetDemoData(modules.dbModule.db, { demoMode: true });
  });

  /** A snapshot of every table, to compare two runs of the seed. */
  async function snapshot() {
    const { db, schema } = modules.dbModule;
    const entries = await Promise.all(
      Object.entries(schema).map(async ([name, table]) => {
        const rows = await db.select().from(table);
        return [name, rows.length] as const;
      }),
    );
    return Object.fromEntries(entries);
  }

  it("seeds the catalog, the App admin, the organization and a failed plan change", async () => {
    const { db, plan, user, organization, pendingPlanChange, account } = modules.dbModule;

    const summary = await modules.seedModule.seedDemoData(db, OPTIONS);

    expect(summary.plans).toBe(7);
    const plans = await db.select().from(plan);
    expect(plans.map((row) => row.id)).toContain("polar_pro_month");
    expect(plans.find((row) => row.id === "polar_basic_month")?.providerPlanId).toBe(
      "00000000-0000-4000-8000-000000000001",
    );

    const [admin] = await db
      .select()
      .from(user)
      .where(sql`${user.id} = 'demo_admin'`);
    expect(admin).toMatchObject({ email: "admin@demo.beztack.test", role: "sudo" });
    const [credential] = await db.select().from(account);
    expect(credential).toMatchObject({
      providerId: "credential",
      userId: "demo_admin",
      password: OPTIONS.adminPasswordHash,
    });

    const orgs = await db.select().from(organization);
    expect(orgs).toHaveLength(1);
    expect(orgs[0]).toMatchObject({
      subscriptionTier: "pro",
      subscriptionBillingCadence: "monthly",
    });

    const changes = await db.select().from(pendingPlanChange);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      status: "failed",
      direction: "downgrade",
      activationAttempts: 5,
      membershipTargetId: "demo_org",
    });
  });

  it("lists the failed plan change the way the admin page reads it", async () => {
    const { db } = modules.dbModule;
    await modules.seedModule.seedDemoData(db, OPTIONS);

    const { listFailedPendingPlanChanges } = await import("./pending-plan-change-ledger");
    const failed = await listFailedPendingPlanChanges();

    expect(failed).toHaveLength(1);
    expect(failed[0]).toMatchObject({
      id: "demo_failed_plan_change",
      membershipTargetName: "Demo Organization",
      acceptedByEmail: "customer@demo.beztack.test",
    });
  });

  it("is idempotent: a second run changes no row count and no id", async () => {
    const { db } = modules.dbModule;

    await modules.seedModule.seedDemoData(db, OPTIONS);
    const first = await snapshot();
    await modules.seedModule.seedDemoData(db, OPTIONS);
    const second = await snapshot();

    expect(second).toEqual(first);
    expect(first).toMatchObject({ plan: 7, user: 2, organization: 1, pendingPlanChange: 1 });
  });

  it("restores a fixture a visitor changed", async () => {
    const { db, pendingPlanChange } = modules.dbModule;
    await modules.seedModule.seedDemoData(db, OPTIONS);
    await db
      .update(pendingPlanChange)
      .set({ status: "activated", activationAttempts: 0 })
      .where(sql`${pendingPlanChange.id} = 'demo_failed_plan_change'`);

    await modules.seedModule.seedDemoData(db, OPTIONS);

    const [row] = await db.select().from(pendingPlanChange);
    expect(row).toMatchObject({ status: "failed", activationAttempts: 5 });
  });

  it("keeps visitor-created data on a plain seed and drops it on reset", async () => {
    const { db, user } = modules.dbModule;
    await modules.seedModule.seedDemoData(db, OPTIONS);
    await db.insert(user).values({ id: "visitor_1", name: "Visitor", email: "v@example.test" });

    await modules.seedModule.seedDemoData(db, OPTIONS);
    expect(await db.select().from(user)).toHaveLength(3);

    await modules.seedModule.resetDemoData(db, { demoMode: true });
    expect(await db.select().from(user)).toHaveLength(0);
    await modules.seedModule.seedDemoData(db, OPTIONS);
    expect(await db.select().from(user)).toHaveLength(2);
  });

  it("refuses to reset when DEMO_MODE is off", async () => {
    const { db, user } = modules.dbModule;
    await modules.seedModule.seedDemoData(db, OPTIONS);

    await expect(modules.seedModule.resetDemoData(db, { demoMode: false })).rejects.toThrow(
      /DEMO_MODE is not enabled/,
    );
    expect(await db.select().from(user)).toHaveLength(2);
  });

  it("seeds Mercado Pago plans in the project currency, monthly only", async () => {
    const { db, plan } = modules.dbModule;

    const summary = await modules.seedModule.seedDemoData(db, {
      ...OPTIONS,
      provider: "mercadopago",
      currency: "UYU",
      providerPlanIds: undefined,
    });

    expect(summary.plans).toBe(4);
    const plans = await db.select().from(plan);
    expect(new Set(plans.map((row) => row.currency))).toEqual(new Set(["UYU"]));
    expect(plans.map((row) => row.interval)).toEqual(Array(4).fill("month"));
  });
});
