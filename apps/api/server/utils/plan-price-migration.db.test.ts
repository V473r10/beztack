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
import { currencyDecimals, ISO_4217_MINOR_UNITS } from "@beztack/payments/money";
import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

if (process.env.CI && !TEST_DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL is required on CI for the price migration tests");
}

const MIGRATIONS_FOLDER = resolve(import.meta.dirname, "../../../../packages/db/drizzle");

/** Tag of the migration that moves prices to integer minor units. */
const PRICE_MIGRATION_TAG = "0009_prices_minor_units";

/** Every currency the ISO 4217 table knows. */
const ALL_CURRENCIES = Object.keys(ISO_4217_MINOR_UNITS);

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

/**
 * Old-convention plans: [id, provider, currency, price as stored before].
 * A Polar id of the seed's pattern (polar_<tier>_<month|year>) was written in cents; any other
 * Polar id (a UUID from admin create, import or sync) was written in major units.
 */
const OLD_PLANS = [
  ["polar_free_month", "polar", "USD", "0"],
  ["polar_basic_month", "polar", "USD", "900"],
  ["polar_pro_year", "polar", "USD", "29000"],
  ["00000000-0000-4000-8000-0000000000a1", "polar", "USD", "9.99"], // admin-created, dollars
  ["00000000-0000-4000-8000-0000000000a2", "polar", "USD", "9"], // imported, whole dollars
  ["00000000-0000-4000-8000-0000000000a3", "polar", "JPY", "5000"], // JPY has no minor unit
  ["00000000-0000-4000-8000-0000000000a4", "polar", "USD", "1.005"], // half away from zero
  ["mp_basic_uyu", "mercadopago", "UYU", "4500"],
  ["mp_basic_jpy", "mercadopago", "JPY", "5000"],
  ["mp_basic_kwd", "mercadopago", "KWD", "12.5"],
  ["mp_cents_usd", "mercadopago", "USD", "9.99"],
  ["mp_half_usd", "mercadopago", "USD", "1.005"],
  ["stripe_basic_usd", "stripe", "USD", "2900"],
] as const;

/**
 * Old-convention snapshots: [id, status, provider, currency, amount as stored before, plan id].
 * The plan id defaults to `<provider>_basic_month`, the seed's own pattern.
 */
const OLD_SNAPSHOTS = [
  ["ppc_polar_failed", "failed", "polar", "USD", 900],
  ["ppc_polar_activated", "activated", "polar", "USD", 2900],
  ["ppc_polar_admin_plan", "pending", "polar", "USD", 9.99, "00000000-0000-4000-8000-0000000000a1"],
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

type Db = typeof import("@beztack/db").db;
type Migrate = typeof import("drizzle-orm/postgres-js/migrator").migrate;

/** Empties the database and builds the schema as it was before the price migration. Returns the scratch folder to remove. */
async function buildOldSchema(db: Db, migrate: Migrate): Promise<string> {
  const scratch = mkdtempSync(join(tmpdir(), "beztack-price-migration-"));
  copyMigrationsWithout(PRICE_MIGRATION_TAG, scratch);
  await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
  await db.execute(sql`DROP SCHEMA public CASCADE`);
  await db.execute(sql`CREATE SCHEMA public`);
  await migrate(db, { migrationsFolder: scratch });
  return scratch;
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

    scratchFolder = await buildOldSchema(db, migrate);

    for (const [id, provider, currency, price] of OLD_PLANS) {
      await db.execute(sql`
        INSERT INTO plan (id, provider, canonical_tier_id, display_name, price, currency, interval)
        VALUES (${id}, ${provider}, 'basic', ${id}, ${price}::numeric, ${currency}, 'month')
      `);
    }

    // One Mercado Pago plan of 1 major unit for every ISO 4217 currency.
    for (const currency of ALL_CURRENCIES) {
      await db.execute(sql`
        INSERT INTO plan (id, provider, canonical_tier_id, display_name, price, currency, interval)
        VALUES (${`all_${currency}`}, 'mercadopago', 'basic', ${currency}, 1, ${currency}, 'month')
      `);
    }

    await db.execute(sql`
      INSERT INTO subscription (id, provider, status)
      SELECT 'sub_' || n, 'polar', 'active' FROM generate_series(1, ${OLD_SNAPSHOTS.length}) AS n
    `);
    for (const [index, snapshotRow] of OLD_SNAPSHOTS.entries()) {
      const [id, status, provider, currency, amount] = snapshotRow;
      const planId = snapshotRow[5] ?? `${provider}_basic_month`;
      const snapshot = {
        id: planId,
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

  afterAll(() => {
    // The client is shared with the next describe, which closes it.
    if (scratchFolder) {
      rmSync(scratchFolder, { recursive: true, force: true });
    }
  });

  it("starts from the old convention", () => {
    expect(before).toEqual({
      plans: OLD_PLANS.length + ALL_CURRENCIES.length,
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

  it("keeps seeded Polar prices (already cents), scales Polar rows written in major units and Mercado Pago by the currency decimals", async () => {
    const prices = Object.fromEntries(
      (await readPlans())
        .filter((row) => !row.id.startsWith("all_"))
        .map((row) => [row.id, row.price]),
    );
    expect(prices).toEqual({
      polar_free_month: 0,
      polar_basic_month: 900, // US$ 9.00 stays 900 cents
      polar_pro_year: 29_000,
      "00000000-0000-4000-8000-0000000000a1": 999, // admin-created 9.99 is US$ 9.99, not US$ 0.10
      "00000000-0000-4000-8000-0000000000a2": 900,
      "00000000-0000-4000-8000-0000000000a3": 5000,
      "00000000-0000-4000-8000-0000000000a4": 101, // 100.5 rounds half away from zero
      mp_basic_uyu: 450_000, // UYU 4500.00 -> 450000 centésimos
      mp_basic_jpy: 5000, // JPY has no minor unit: unchanged
      mp_basic_kwd: 12_500, // KWD 12.500 -> 12500 fils
      mp_cents_usd: 999,
      mp_half_usd: 101, // 100.5 rounds half away from zero
      stripe_basic_usd: 2900, // not a provider we know the old unit of: untouched
    });
  });

  it("agrees with the ISO 4217 table of @beztack/payments/money on every currency", async () => {
    const converted = (await readPlans()).filter((row) => row.id.startsWith("all_"));
    expect(converted).toHaveLength(ALL_CURRENCIES.length);
    for (const row of converted) {
      // 1 major unit is 10^decimals minor units.
      expect({ currency: row.currency, price: row.price }).toEqual({
        currency: row.currency,
        price: 10 ** currencyDecimals(row.currency),
      });
    }
  });

  it("carries the same ISO 4217 table as @beztack/payments/money", () => {
    const sqlText = readFileSync(join(MIGRATIONS_FOLDER, `${PRICE_MIGRATION_TAG}.sql`), "utf8");
    const fromSql: Record<string, number> = {};
    for (const [name, decimals] of [
      ["zero_decimal", 0],
      ["two_decimal", 2],
      ["three_decimal", 3],
      ["four_decimal", 4],
    ] as const) {
      const match = new RegExp(`${name} text\\[\\] := ARRAY\\[([^\\]]*)\\]`).exec(sqlText);
      expect(match, `${name} in the migration`).not.toBeNull();
      for (const code of (match?.[1] ?? "").match(/[A-Z]{3}/g) ?? []) {
        expect(fromSql[code], `${code} listed twice`).toBeUndefined();
        fromSql[code] = decimals;
      }
    }
    expect(fromSql).toEqual({ ...ISO_4217_MINOR_UNITS });
  });

  it("converts the price inside every Pending Plan change snapshot, whatever its status", async () => {
    const amounts = Object.fromEntries(
      (await readSnapshots()).map((row) => [row.id, row.target_plan_snapshot.price.amount]),
    );
    expect(amounts).toEqual({
      ppc_polar_failed: 900,
      ppc_polar_activated: 2900,
      ppc_polar_admin_plan: 999,
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

describe.skipIf(!TEST_DATABASE_URL)("Price migration refuses data it cannot convert exactly", () => {
  let dbModule: typeof import("@beztack/db");
  let migrate: Migrate;
  let scratchFolder: string;

  async function insertPlan(
    id: string,
    provider: string,
    currency: string,
    price: string,
  ): Promise<void> {
    await dbModule.db.execute(sql`
      INSERT INTO plan (id, provider, canonical_tier_id, display_name, price, currency, interval)
      VALUES (${id}, ${provider}, 'basic', ${id}, ${price}::numeric, ${currency}, 'month')
    `);
  }

  async function priceColumnType(): Promise<string | undefined> {
    const rows = (await dbModule.db.execute(sql`
      SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'plan' AND column_name = 'price'
    `)) as unknown as { data_type: string }[];
    return rows[0]?.data_type;
  }

  /** The migration rejects and leaves the old shape and the old prices untouched. */
  async function expectMigrationToRollBack(): Promise<void> {
    const before = await dbModule.db.execute(sql`SELECT id, price FROM plan ORDER BY id`);
    await expect(migrate(dbModule.db, { migrationsFolder: MIGRATIONS_FOLDER })).rejects.toThrow();
    expect(await priceColumnType()).toBe("numeric");
    expect(await dbModule.db.execute(sql`SELECT id, price FROM plan ORDER BY id`)).toEqual(before);
  }

  beforeAll(async () => {
    const url = TEST_DATABASE_URL as string;
    assertThrowawayDatabase(url);
    process.env.DATABASE_URL = url;
    [dbModule, { migrate }] = await Promise.all([
      import("@beztack/db"),
      import("drizzle-orm/postgres-js/migrator"),
    ]);
  });

  beforeEach(async () => {
    scratchFolder = await buildOldSchema(dbModule.db, migrate);
  });

  afterEach(() => {
    if (scratchFolder) {
      rmSync(scratchFolder, { recursive: true, force: true });
    }
  });

  afterAll(async () => {
    await dbModule?.db.$client.end();
  });

  it("never silently truncates: a seeded Polar price with decimals stops the migration", async () => {
    await insertPlan("polar_basic_month", "polar", "USD", "900.5");
    await expectMigrationToRollBack();
  });

  it("never silently truncates: a price of a provider we cannot convert, with decimals, stops the migration", async () => {
    await insertPlan("stripe_basic_usd", "stripe", "USD", "9.99");
    await expectMigrationToRollBack();
  });

  it("stops when a converted price does not fit in a 32-bit integer", async () => {
    await insertPlan("00000000-0000-4000-8000-0000000000b1", "polar", "USD", "99999999.99");
    await expectMigrationToRollBack();
  });

  it("stops on a Polar plan written in major units whose currency is unknown", async () => {
    await insertPlan("00000000-0000-4000-8000-0000000000b2", "polar", "ZZZ", "9.99");
    await expectMigrationToRollBack();
  });

  it("stops on a Mercado Pago plan in a currency that is not an ISO 4217 code in use", async () => {
    await insertPlan("mp_withdrawn", "mercadopago", "SLL", "4500");
    await expectMigrationToRollBack();
  });
});
