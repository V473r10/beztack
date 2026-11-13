/**
 * The price migration (ADR 0007, "Migrate" step) against a real Postgres.
 *
 * The test builds the schema as it was before the migration (every migration
 * except the last one), inserts rows in the old convention (Polar in cents,
 * Mercado Pago in major units, numeric `plan.price`), applies the real
 * migration and reads the rows back with raw SQL. Runs when TEST_DATABASE_URL
 * names a throwaway database whose name ends in `_test`;
 * skipped otherwise, except on CI, where it must run.
 */
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { currencyDecimals } from "@beztack/payments/money";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

if (process.env.CI && !TEST_DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL is required on CI for the price migration tests");
}

const MIGRATIONS_FOLDER = resolve(import.meta.dirname, "../../../../packages/db/drizzle");

/** Tag of the migration that moves prices to integer minor units. */
const PRICE_MIGRATION_TAG = "0009_prices_minor_units";

type Journal = { entries: { idx: number; tag: string }[] };

type PlanRow = { id: string; price: string | number; currency: string };
type SnapshotRow = {
  id: string;
  status: string;
  target_plan_snapshot: {
    id: string;
    paymentProvider: string;
    canonicalTierId: string;
    price: { amount: number; currency: string };
  };
};

/** Old-convention plans: [id, provider, currency, price as stored before]. */
const OLD_PLANS = [
  ["polar_free_month", "polar", "USD", "0"],
  ["polar_basic_month", "polar", "USD", "900"],
  ["polar_pro_year", "polar", "USD", "29000"],
  ["mp_basic_uyu", "mercadopago", "UYU", "4500"],
  ["mp_basic_jpy", "mercadopago", "JPY", "5000"],
  ["mp_basic_kwd", "mercadopago", "KWD", "12.5"],
  ["mp_cents_usd", "mercadopago", "USD", "9.99"],
  ["mp_half_usd", "mercadopago", "USD", "1.005"],
  ["stripe_basic_usd", "stripe", "USD", "2900"],
] as const;

/** Old-convention snapshots: [id, status, provider, currency, amount as stored before]. */
const OLD_SNAPSHOTS = [
  ["ppc_polar_failed", "failed", "polar", "USD", 900],
  ["ppc_polar_activated", "activated", "polar", "USD", 2900],
  ["ppc_mp_uyu_pending", "pending", "mercadopago", "UYU", 4500],
  ["ppc_mp_jpy_failed", "failed", "mercadopago", "JPY", 5000],
  ["ppc_mp_kwd_canceled", "canceled", "mercadopago", "KWD", 12.5],
] as const;

function assertThrowawayDatabase(url: string): void {
  const name = new URL(url).pathname.replace(/^\//, "");
  if (!name.endsWith("_test")) {
    throw new Error(`Refusing to reset "${name}": TEST_DATABASE_URL must name a *_test database`);
  }
}

/** The migrations folder without the price migration: the schema users have today. */
function copyMigrationsWithout(tag: string, destination: string): void {
  cpSync(MIGRATIONS_FOLDER, destination, { recursive: true });
  const journalPath = join(destination, "meta/_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as Journal;
  journal.entries = journal.entries.filter((entry) => entry.tag !== tag);
  writeFileSync(journalPath, JSON.stringify(journal));
}

describe.skipIf(!TEST_DATABASE_URL)("Price migration on Postgres", () => {
  let dbModule: typeof import("@beztack/db");
  let migrate: typeof import("drizzle-orm/postgres-js/migrator").migrate;
  let scratchFolder: string;
  let before: { plans: number; changes: number };

  async function readPlans(): Promise<PlanRow[]> {
    return (await dbModule.db.execute(
      sql`SELECT id, price, currency FROM plan ORDER BY id`,
    )) as unknown as PlanRow[];
  }

  async function readSnapshots(): Promise<SnapshotRow[]> {
    return (await dbModule.db.execute(
      sql`SELECT id, status, target_plan_snapshot FROM pending_plan_change ORDER BY id`,
    )) as unknown as SnapshotRow[];
  }

  async function count(table: "plan" | "pending_plan_change"): Promise<number> {
    const rows = (await dbModule.db.execute(
      sql.raw(`SELECT count(*)::int AS n FROM "${table}"`),
    )) as unknown as { n: number }[];
    return rows[0]?.n ?? -1;
  }

  beforeAll(async () => {
    const url = TEST_DATABASE_URL as string;
    assertThrowawayDatabase(url);
    // @beztack/db opens its client from DATABASE_URL when first imported.
    process.env.DATABASE_URL = url;
    [dbModule, { migrate }] = await Promise.all([
      import("@beztack/db"),
      import("drizzle-orm/postgres-js/migrator"),
    ]);
    const { db } = dbModule;

    scratchFolder = mkdtempSync(join(tmpdir(), "beztack-price-migration-"));
    copyMigrationsWithout(PRICE_MIGRATION_TAG, scratchFolder);

    await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
    await db.execute(sql`DROP SCHEMA public CASCADE`);
    await db.execute(sql`CREATE SCHEMA public`);
    await migrate(db, { migrationsFolder: scratchFolder });

    for (const [id, provider, currency, price] of OLD_PLANS) {
      await db.execute(sql`
        INSERT INTO plan (id, provider, canonical_tier_id, display_name, price, currency, interval)
        VALUES (${id}, ${provider}, 'basic', ${id}, ${price}::numeric, ${currency}, 'month')
      `);
    }

    // One Mercado Pago plan of 1 major unit for every currency Intl knows.
    for (const currency of Intl.supportedValuesOf("currency")) {
      await db.execute(sql`
        INSERT INTO plan (id, provider, canonical_tier_id, display_name, price, currency, interval)
        VALUES (${`all_${currency}`}, 'mercadopago', 'basic', ${currency}, 1, ${currency}, 'month')
      `);
    }

    await db.execute(sql`
      INSERT INTO subscription (id, provider, status)
      SELECT 'sub_' || n, 'polar', 'active' FROM generate_series(1, ${OLD_SNAPSHOTS.length}) AS n
    `);
    for (const [index, [id, status, provider, currency, amount]] of OLD_SNAPSHOTS.entries()) {
      const snapshot = {
        id: `${provider}_basic_month`,
        paymentProvider: provider,
        providerPlanId: null,
        canonicalTierId: "basic",
        tierRank: 1,
        billingCadence: "monthly",
        price: { amount, currency },
      };
      await db.execute(sql`
        INSERT INTO pending_plan_change (
          id, subscription_id, direction, membership_target_type, membership_target_id,
          target_plan_snapshot, provider_confirmed_plan_change_id, status
        ) VALUES (
          ${id}, ${`sub_${index + 1}`}, 'downgrade', 'organization', 'org_1',
          ${JSON.stringify(snapshot)}::jsonb, 'confirmed_1', ${status}
        )
      `);
    }

    before = { plans: await count("plan"), changes: await count("pending_plan_change") };
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  });

  afterAll(async () => {
    await dbModule?.db.$client.end();
    if (scratchFolder) {
      rmSync(scratchFolder, { recursive: true, force: true });
    }
  });

  it("starts from the old convention", () => {
    expect(before).toEqual({
      plans: OLD_PLANS.length + Intl.supportedValuesOf("currency").length,
      changes: OLD_SNAPSHOTS.length,
    });
  });

  it("keeps the same number of plans and Pending Plan changes", async () => {
    expect(await count("plan")).toBe(before.plans);
    expect(await count("pending_plan_change")).toBe(before.changes);
  });

  it("makes plan.price an integer column", async () => {
    const rows = (await dbModule.db.execute(sql`
      SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'plan' AND column_name = 'price'
    `)) as unknown as { data_type: string }[];
    expect(rows[0]?.data_type).toBe("integer");
  });

  it("keeps Polar prices (already cents) and scales Mercado Pago major units by the currency decimals", async () => {
    const prices = Object.fromEntries(
      (await readPlans()).filter((row) => !row.id.startsWith("all_")).map((row) => [row.id, row.price]),
    );
    expect(prices).toEqual({
      polar_free_month: 0,
      polar_basic_month: 900, // US$ 9.00 stays 900 cents
      polar_pro_year: 29_000,
      mp_basic_uyu: 450_000, // UYU 4500.00 -> 450000 centésimos
      mp_basic_jpy: 5000, // JPY has no minor unit: unchanged
      mp_basic_kwd: 12_500, // KWD 12.500 -> 12500 fils
      mp_cents_usd: 999,
      mp_half_usd: 101, // 100.5 rounds half away from zero
      stripe_basic_usd: 2900, // not a provider we know the old unit of: untouched
    });
  });

  it("agrees with currencyDecimals() on the decimals of every currency", async () => {
    const converted = (await readPlans()).filter((row) => row.id.startsWith("all_"));
    expect(converted).toHaveLength(Intl.supportedValuesOf("currency").length);
    for (const row of converted) {
      // 1 major unit is 10^decimals minor units.
      expect({ currency: row.currency, price: row.price }).toEqual({
        currency: row.currency,
        price: 10 ** currencyDecimals(row.currency),
      });
    }
  });

  it("converts the price inside every Pending Plan change snapshot, whatever its status", async () => {
    const amounts = Object.fromEntries(
      (await readSnapshots()).map((row) => [row.id, row.target_plan_snapshot.price.amount]),
    );
    expect(amounts).toEqual({
      ppc_polar_failed: 900,
      ppc_polar_activated: 2900,
      ppc_mp_uyu_pending: 450_000,
      ppc_mp_jpy_failed: 5000,
      ppc_mp_kwd_canceled: 12_500,
    });
  });

  it("leaves every other snapshot field and the row status as they were", async () => {
    const rows = await readSnapshots();
    const failed = rows.find((row) => row.id === "ppc_mp_jpy_failed");
    expect(failed?.status).toBe("failed");
    expect(failed?.target_plan_snapshot).toEqual({
      id: "mercadopago_basic_month",
      paymentProvider: "mercadopago",
      providerPlanId: null,
      canonicalTierId: "basic",
      tierRank: 1,
      billingCadence: "monthly",
      price: { amount: 5000, currency: "JPY" },
    });
  });

  it("is idempotent: applying the migration again never converts twice", async () => {
    const plansAfterFirstRun = await readPlans();
    const snapshotsAfterFirstRun = await readSnapshots();

    // Another drizzle run: nothing pending, nothing happens.
    await migrate(dbModule.db, { migrationsFolder: MIGRATIONS_FOLDER });

    // The same SQL replayed by hand, as after a restored journal.
    const statements = readFileSync(join(MIGRATIONS_FOLDER, `${PRICE_MIGRATION_TAG}.sql`), "utf8")
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);
    for (const statement of statements) {
      await dbModule.db.execute(sql.raw(statement));
    }

    expect(await readPlans()).toEqual(plansAfterFirstRun);
    expect(await readSnapshots()).toEqual(snapshotsAfterFirstRun);
  });
});
