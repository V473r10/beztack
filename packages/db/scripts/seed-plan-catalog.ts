/**
 * Seed script to populate the plan catalog with default tier data.
 *
 * Run after schema migration:
 *   pnpm tsx packages/db/scripts/seed-plan-catalog.ts polar
 *   pnpm tsx packages/db/scripts/seed-plan-catalog.ts mercadopago
 *
 * This script upserts plans by canonical tier ID + provider + interval.
 */
import { and, eq } from "drizzle-orm";
import { db } from "../src/client";
import { buildSeedPlans, seedPlanId } from "../src/plan-catalog";
import { plan } from "../src/schema";

/**
 * Polar prices in USD (the only currency Polar charges in). Mercado Pago
 * plans use the project's DEFAULT_CURRENCY; there is no built-in default.
 */
function resolveSeedCurrency(isMP: boolean): string {
  if (!isMP) {
    return "USD";
  }
  const currency = process.env.DEFAULT_CURRENCY?.trim();
  if (!currency) {
    throw new Error("DEFAULT_CURRENCY is required to seed Mercado Pago plans");
  }
  return currency;
}

async function main() {
  const provider = process.argv[2] ?? "polar";
  // biome-ignore lint/suspicious/noConsole: seed script
  console.info(`[seed] Starting plan catalog seed for provider: ${provider}`);

  const seedPlans = buildSeedPlans(provider, resolveSeedCurrency(provider === "mercadopago"));
  let upserted = 0;

  for (const seed of seedPlans) {
    const id = seedPlanId(provider, seed);

    const [existing] = await db
      .select({ id: plan.id })
      .from(plan)
      .where(and(eq(plan.id, id)))
      .limit(1);

    const values = {
      id,
      provider,
      canonicalTierId: seed.canonicalTierId,
      displayName: seed.displayName,
      description: seed.description,
      features: seed.features,
      limits: seed.limits,
      permissions: seed.permissions,
      price: String(seed.price),
      currency: seed.currency,
      interval: seed.interval,
      displayOrder: seed.displayOrder,
      highlighted: seed.highlighted,
      visible: true,
    };

    if (existing) {
      await db.update(plan).set(values).where(eq(plan.id, id));
    } else {
      await db.insert(plan).values(values);
    }

    upserted++;
    // biome-ignore lint/suspicious/noConsole: seed script
    console.info(`[seed] Upserted plan: ${seed.displayName} (${id})`);
  }

  // biome-ignore lint/suspicious/noConsole: seed script
  console.info(`[seed] Done. Upserted ${upserted} plans.`);
  process.exit(0);
}

main().catch((error) => {
  // biome-ignore lint/suspicious/noConsole: seed script
  console.error("[seed] Error:", error);
  process.exit(1);
});
