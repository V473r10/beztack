/**
 * The Pending Plan change ledger against a real Postgres.
 *
 * The in-memory ledgers elsewhere fake what this file proves on the database:
 * the partial unique index, the single-statement failure count, the latest
 * activated row. Runs when TEST_DATABASE_URL names a throwaway database whose
 * name ends in `_test` (the schema is dropped and rebuilt from the real
 * migrations); skipped otherwise, except on CI, where it must run.
 */
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { NewPendingPlanChange, PlanChangeCatalogPlan } from "./plan-change";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

if (process.env.CI && !TEST_DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL is required on CI for the Pending Plan change ledger tests");
}

const MIGRATIONS_FOLDER = resolve(import.meta.dirname, "../../../../packages/db/drizzle");

const TARGET_PLAN: PlanChangeCatalogPlan = {
  id: "plan_basic",
  paymentProvider: "mercadopago",
  providerPlanId: "mp_plan_basic",
  canonicalTierId: "basic",
  tierRank: 1,
  billingCadence: "monthly",
  price: { amount: 500, currency: "UYU" },
};

type Modules = {
  dbModule: typeof import("@beztack/db");
  ledgerModule: typeof import("./pending-plan-change-ledger");
};

function assertThrowawayDatabase(url: string): void {
  const name = new URL(url).pathname.replace(/^\//, "");
  if (!name.endsWith("_test")) {
    throw new Error(`Refusing to reset "${name}": TEST_DATABASE_URL must name a *_test database`);
  }
}

describe.skipIf(!TEST_DATABASE_URL)("Pending Plan change ledger on Postgres", () => {
  let modules: Modules;

  beforeAll(async () => {
    const url = TEST_DATABASE_URL as string;
    assertThrowawayDatabase(url);
    // @beztack/db opens its client from DATABASE_URL when first imported.
    process.env.DATABASE_URL = url;
    const [dbModule, ledgerModule, { migrate }] = await Promise.all([
      import("@beztack/db"),
      import("./pending-plan-change-ledger"),
      import("drizzle-orm/postgres-js/migrator"),
    ]);
    modules = { dbModule, ledgerModule };

    await dbModule.db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
    await dbModule.db.execute(sql`DROP SCHEMA public CASCADE`);
    await dbModule.db.execute(sql`CREATE SCHEMA public`);
    await migrate(dbModule.db, { migrationsFolder: MIGRATIONS_FOLDER });
  });

  afterAll(async () => {
    await modules?.dbModule.db.$client.end();
  });

  beforeEach(async () => {
    const { db, organization, pendingPlanChange, subscription, user } = modules.dbModule;
    await db.delete(pendingPlanChange);
    await db.delete(subscription);
    await db.delete(organization);
    await db.delete(user);
    await db.insert(user).values({ id: "user_1", name: "User", email: "user@example.com" });
    await db.insert(subscription).values([
      { id: "sub_1", provider: "mercadopago", status: "authorized", userId: "user_1" },
      { id: "sub_2", provider: "mercadopago", status: "authorized", userId: "user_1" },
    ]);
  });

  function change(overrides: Partial<NewPendingPlanChange> = {}): NewPendingPlanChange {
    return {
      acceptedByUserId: "user_1",
      direction: "downgrade",
      effectiveAt: new Date("2026-07-01T00:00:00.000Z"),
      membershipTarget: { type: "user", id: "user_1" },
      providerConfirmedPlanChangeId: "mp_plan_basic",
      subscriptionId: "sub_1",
      targetPlanSnapshot: TARGET_PLAN,
      ...overrides,
    };
  }

  async function statuses(subscriptionId: string) {
    const { db, pendingPlanChange } = modules.dbModule;
    const rows = await db
      .select({ status: pendingPlanChange.status, reason: pendingPlanChange.reason })
      .from(pendingPlanChange)
      .where(sql`${pendingPlanChange.subscriptionId} = ${subscriptionId}`)
      .orderBy(pendingPlanChange.createdAt);
    return rows.map((row) => [row.status, row.reason]);
  }

  it("round-trips a saved change, target plan snapshot included", async () => {
    const ledger = modules.ledgerModule.createDbPendingPlanChangeLedger();

    const saved = await ledger.savePendingPlanChange(change());

    await expect(ledger.findPendingPlanChange("sub_1")).resolves.toEqual(saved);
    expect(saved).toMatchObject({
      activationAttempts: 0,
      status: "pending",
      targetPlanSnapshot: TARGET_PLAN,
    });
  });

  it("replaces the pending change, keeping the old row as canceled", async () => {
    const ledger = modules.ledgerModule.createDbPendingPlanChangeLedger();

    await ledger.savePendingPlanChange(change());
    await ledger.savePendingPlanChange(change({ providerConfirmedPlanChangeId: "mp_plan_free" }));

    await expect(statuses("sub_1")).resolves.toEqual([
      ["canceled", "replaced"],
      ["pending", null],
    ]);
  });

  it("refuses a second pending row for one Subscription", async () => {
    const { db, pendingPlanChange } = modules.dbModule;
    const row = (id: string) => ({
      id,
      subscriptionId: "sub_1",
      direction: "downgrade",
      membershipTargetType: "user",
      membershipTargetId: "user_1",
      targetPlanSnapshot: TARGET_PLAN,
      providerConfirmedPlanChangeId: "mp_plan_basic",
    });

    await db.insert(pendingPlanChange).values(row(randomUUID()));

    await expect(db.insert(pendingPlanChange).values(row(randomUUID()))).rejects.toThrow();
  });

  it("records who canceled and why", async () => {
    const ledger = modules.ledgerModule.createDbPendingPlanChangeLedger();
    await ledger.savePendingPlanChange(change());

    const canceled = await ledger.cancelPendingPlanChange("sub_1", {
      canceledByUserId: "user_1",
      reason: "user",
    });

    expect(canceled).toMatchObject({
      canceledByUserId: "user_1",
      reason: "user",
      status: "canceled",
    });
    await expect(ledger.findPendingPlanChange("sub_1")).resolves.toBeNull();
  });

  it("counts concurrent activation failures without losing one", async () => {
    const ledger = modules.ledgerModule.createDbPendingPlanChangeLedger();
    await ledger.savePendingPlanChange(change());

    await Promise.all(
      Array.from({ length: 4 }, () =>
        ledger.recordPendingPlanChangeActivationFailure("sub_1", {
          error: "provider timeout",
          maxAttempts: 10,
        }),
      ),
    );

    await expect(ledger.findPendingPlanChange("sub_1")).resolves.toMatchObject({
      activationAttempts: 4,
      reason: "provider timeout",
      status: "pending",
    });
  });

  it("marks the change failed when the attempts reach the limit", async () => {
    const { ledgerModule } = modules;
    const ledger = ledgerModule.createDbPendingPlanChangeLedger();
    await ledger.savePendingPlanChange(change());
    const fail = () =>
      ledger.recordPendingPlanChangeActivationFailure("sub_1", {
        error: "kept charging 1000",
        maxAttempts: 2,
      });

    await expect(fail()).resolves.toMatchObject({ activationAttempts: 1, status: "pending" });
    await expect(fail()).resolves.toMatchObject({ activationAttempts: 2, status: "failed" });

    const [failed] = await ledgerModule.listFailedPendingPlanChanges();
    expect(failed).toMatchObject({ subscriptionId: "sub_1", reason: "kept charging 1000" });
    expect(failed.failedAt).toBeInstanceOf(Date);
  });

  it("requeues a failed change only while no newer one is pending", async () => {
    const ledger = modules.ledgerModule.createDbPendingPlanChangeLedger();
    const saved = await ledger.savePendingPlanChange(change());
    await ledger.recordPendingPlanChangeActivationFailure("sub_1", {
      error: "boom",
      maxAttempts: 1,
    });

    const retriedAt = new Date("2026-07-03T12:00:00.000Z");
    const retry = () =>
      ledger.requeueFailedPendingPlanChange(saved.id, { retriedAt, retriedByUserId: "user_1" });

    await expect(retry()).resolves.toMatchObject({
      activationAttempts: 1,
      reason: "boom",
      retriedAt,
      retriedByUserId: "user_1",
      status: "pending",
    });
    // Already pending again: a second retry has nothing to requeue.
    await expect(retry()).resolves.toBeNull();

    await ledger.recordPendingPlanChangeActivationFailure("sub_1", {
      error: "boom again",
      maxAttempts: 2,
    });
    const [failedAgain] = await modules.ledgerModule.listFailedPendingPlanChanges();
    expect(failedAgain).toMatchObject({ retriedByEmail: "user@example.com", retriedAt });

    await ledger.savePendingPlanChange(change());
    await expect(retry()).resolves.toBeNull();
    expect(await statuses("sub_1")).toEqual([
      ["failed", "boom again"],
      ["pending", null],
    ]);
  });

  it("names who each failed change belongs to and who accepted it", async () => {
    const { db, organization } = modules.dbModule;
    await db.insert(organization).values({ id: "org_1", name: "Acme", slug: "acme" });
    const ledger = modules.ledgerModule.createDbPendingPlanChangeLedger();
    await ledger.savePendingPlanChange(change());
    await ledger.savePendingPlanChange(
      change({
        acceptedByUserId: null,
        membershipTarget: { type: "organization", id: "org_1" },
        subscriptionId: "sub_2",
      }),
    );
    for (const subscriptionId of ["sub_1", "sub_2"]) {
      await ledger.recordPendingPlanChangeActivationFailure(subscriptionId, {
        error: "boom",
        maxAttempts: 1,
      });
    }

    const failed = await modules.ledgerModule.listFailedPendingPlanChanges();
    const bySubscription = Object.fromEntries(failed.map((item) => [item.subscriptionId, item]));

    expect(bySubscription.sub_1).toMatchObject({
      membershipTargetName: "user@example.com",
      acceptedByEmail: "user@example.com",
    });
    expect(bySubscription.sub_2).toMatchObject({
      membershipTargetName: "Acme",
      acceptedByEmail: null,
    });
  });

  it("finds the latest activated change of a Subscription", async () => {
    const ledger = modules.ledgerModule.createDbPendingPlanChangeLedger();
    await ledger.savePendingPlanChange(change());
    await ledger.markPendingPlanChangeActivated("sub_1");
    const free = { ...TARGET_PLAN, id: "plan_free", canonicalTierId: "free", tierRank: 0 };
    await ledger.savePendingPlanChange(change({ targetPlanSnapshot: free }));
    await ledger.markPendingPlanChangeActivated("sub_1");

    const latest = await ledger.findLatestActivatedPlanChange("sub_1");

    expect(latest?.targetPlanSnapshot.canonicalTierId).toBe("free");
    await expect(ledger.findLatestActivatedPlanChange("sub_2")).resolves.toBeNull();
  });

  it("finds a Membership target's pending change across Subscriptions", async () => {
    const { ledgerModule } = modules;
    const ledger = ledgerModule.createDbPendingPlanChangeLedger();
    await ledger.savePendingPlanChange(change({ subscriptionId: "sub_2" }));

    const found = await ledgerModule.findPendingPlanChangeForMembershipTarget({
      type: "user",
      id: "user_1",
    });

    expect(found?.subscriptionId).toBe("sub_2");
  });
});
