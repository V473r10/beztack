/**
 * Seeds the public live demo database (docs/demo.md).
 *
 *   pnpm demo:seed            upsert the demo fixtures (idempotent)
 *   pnpm demo:reset           empty every table, then seed (the periodic reset)
 *
 * Both first check that the configured provider products exist with the right
 * tier and cadence (`pnpm demo:check` runs only that) and abort before writing
 * when one does not.
 *
 * Needs the API env (apps/api/.env) with DEMO_MODE=true, DEMO_ADMIN_EMAIL and
 * DEMO_ADMIN_PASSWORD. Loading the env runs the sandbox-only check, so this
 * refuses to touch a database when payments are not sandbox. Secrets are never
 * printed.
 */
import "dotenv/config";
import { hashPassword } from "better-auth/crypto";
import { db } from "@beztack/db";
import { env } from "@beztack/env/api";
import { parseAppAdminEmails } from "../server/domain/organization-access/implementation";
import { type DemoProvider, resetDemoData, seedDemoData } from "../server/utils/demo-seed";
import { checkDemoProviderProducts } from "./demo-provider-check";

function log(message: string): void {
  // biome-ignore lint/suspicious/noConsole: CLI script
  console.info(`[demo-seed ${new Date().toISOString()}] ${message}`);
}

function fail(message: string): never {
  // biome-ignore lint/suspicious/noConsole: CLI script
  console.error(`[demo-seed] ${message}`);
  process.exit(1);
}

/** Polar product ids from the env, keyed by plan row id. Mercado Pago ids come from plan sync. */
function polarProviderPlanIds(): Record<string, string> {
  return {
    polar_basic_month: env.POLAR_BASIC_MONTHLY_PRODUCT_ID,
    polar_basic_year: env.POLAR_BASIC_YEARLY_PRODUCT_ID,
    polar_pro_month: env.POLAR_PRO_MONTHLY_PRODUCT_ID,
    polar_pro_year: env.POLAR_PRO_YEARLY_PRODUCT_ID,
    polar_ultimate_month: env.POLAR_ULTIMATE_MONTHLY_PRODUCT_ID,
    polar_ultimate_year: env.POLAR_ULTIMATE_YEARLY_PRODUCT_ID,
  };
}

async function main(): Promise<void> {
  if (!env.DEMO_MODE) {
    fail("DEMO_MODE=true is required: this script is only for the demo database");
  }
  if (!(env.DEMO_ADMIN_EMAIL && env.DEMO_ADMIN_PASSWORD)) {
    fail("DEMO_ADMIN_EMAIL and DEMO_ADMIN_PASSWORD are required");
  }
  if (!parseAppAdminEmails(env.APP_ADMIN_EMAILS).includes(env.DEMO_ADMIN_EMAIL.toLowerCase())) {
    fail("DEMO_ADMIN_EMAIL must also be listed in APP_ADMIN_EMAILS, or the admin pages answer 403");
  }

  // Before anything is written, and before a reset empties the tables.
  await checkDemoProviderProducts(log);

  const provider: DemoProvider = env.PAYMENT_PROVIDER;
  if (process.argv.includes("--reset")) {
    log("Emptying every table");
    await resetDemoData(db, { demoMode: env.DEMO_MODE });
  }

  const summary = await seedDemoData(db, {
    provider,
    currency: env.DEFAULT_CURRENCY,
    adminEmail: env.DEMO_ADMIN_EMAIL,
    adminPasswordHash: await hashPassword(env.DEMO_ADMIN_PASSWORD),
    providerPlanIds: provider === "polar" ? polarProviderPlanIds() : undefined,
  });
  log(
    `Seeded ${summary.plans} ${provider} plans, App admin ${summary.adminEmail}, ` +
      `organization ${summary.organizationId}, failed plan change ${summary.failedPlanChangeId}`,
  );
}

main()
  .then(async () => {
    await db.$client.end();
  })
  .catch(async (error: unknown) => {
    // biome-ignore lint/suspicious/noConsole: CLI script
    console.error("[demo-seed] Error:", error instanceof Error ? error.message : error);
    await db.$client.end();
    process.exit(1);
  });
