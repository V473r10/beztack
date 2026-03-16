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
import { plan } from "../src/schema";

type BaseTier = {
  canonicalTierId: string;
  displayName: string;
  description: string;
  features: string[];
  limits: Record<string, number>;
  permissions: string[];
  displayOrder: number;
  highlighted: boolean;
};

const BASE_TIERS: BaseTier[] = [
  {
    canonicalTierId: "free",
    displayName: "Free",
    description: "For personal projects and evaluation",
    features: ["basic_dashboard"],
    limits: { users: 1, projects: 1, storage: 1, apiCalls: 1000 },
    permissions: ["dashboard.read"],
    displayOrder: 0,
    highlighted: false,
  },
  {
    canonicalTierId: "basic",
    displayName: "Basic",
    description: "For growing teams",
    features: [
      "basic_dashboard",
      "up_to_5_users",
      "community_support",
      "export_data",
    ],
    limits: { users: 5, projects: 3, storage: 10, apiCalls: 10_000 },
    permissions: [
      "dashboard.read",
      "projects.read",
      "projects.write",
      "billing.read",
    ],
    displayOrder: 1,
    highlighted: false,
  },
  {
    canonicalTierId: "pro",
    displayName: "Pro",
    description: "For production teams that need scale",
    features: [
      "basic_dashboard",
      "advanced_analytics",
      "up_to_50_users",
      "priority_support",
      "custom_integrations",
      "export_data",
    ],
    limits: { users: 50, projects: 25, storage: 100, apiCalls: 100_000 },
    permissions: [
      "dashboard.read",
      "projects.read",
      "projects.write",
      "billing.read",
      "billing.write",
      "analytics.read",
    ],
    displayOrder: 2,
    highlighted: true,
  },
  {
    canonicalTierId: "ultimate",
    displayName: "Ultimate",
    description: "Enterprise-grade limits and support",
    features: [
      "basic_dashboard",
      "advanced_analytics",
      "unlimited_users",
      "dedicated_support",
      "custom_integrations",
      "export_data",
      "white_label",
      "sla_guarantee",
      "advanced_security",
      "audit_logs",
    ],
    limits: {
      users: -1,
      projects: -1,
      storage: 1000,
      apiCalls: 1_000_000,
    },
    permissions: [
      "dashboard.read",
      "projects.read",
      "projects.write",
      "billing.read",
      "billing.write",
      "analytics.read",
      "analytics.write",
      "admin.read",
      "admin.write",
    ],
    displayOrder: 3,
    highlighted: false,
  },
];

/**
 * Prices per provider:
 * - Polar: in cents (900 = $9 USD)
 * - MercadoPago: in display currency (45 = 45 UYU)
 */
const POLAR_PRICING: Record<string, { monthly: number; yearly: number }> = {
  free: { monthly: 0, yearly: 0 },
  basic: { monthly: 900, yearly: 9000 }, // $9/mo, $90/yr
  pro: { monthly: 2900, yearly: 29_000 }, // $29/mo, $290/yr
  ultimate: { monthly: 9900, yearly: 99_000 }, // $99/mo, $990/yr
};

const MP_PRICING: Record<string, { monthly: number }> = {
  free: { monthly: 0 },
  basic: { monthly: 4500 }, // 4500/mo UYU
  pro: { monthly: 8000 }, // 8000/mo UYU
  ultimate: { monthly: 15_000 }, // 15000/mo UYU
};

type Interval = "month" | "year";

type SeedPlan = BaseTier & {
  price: number;
  currency: string;
  interval: Interval;
};

function buildSeedPlans(provider: string): SeedPlan[] {
  const isMP = provider === "mercadopago";
  const pricing = isMP ? MP_PRICING : POLAR_PRICING;
  const currency = isMP ? "UYU" : "USD";
  const plans: SeedPlan[] = [];

  for (const tier of BASE_TIERS) {
    const prices = pricing[tier.canonicalTierId] ?? { monthly: 0 };

    plans.push({ ...tier, price: prices.monthly, currency, interval: "month" });

    if (
      !isMP &&
      "yearly" in prices &&
      (prices as { yearly: number }).yearly > 0
    ) {
      plans.push({
        ...tier,
        price: (prices as { yearly: number }).yearly,
        currency,
        interval: "year",
      });
    }
  }

  return plans;
}

async function main() {
  const provider = process.argv[2] ?? "polar";
  // biome-ignore lint/suspicious/noConsole: seed script
  console.info(`[seed] Starting plan catalog seed for provider: ${provider}`);

  const seedPlans = buildSeedPlans(provider);
  let upserted = 0;

  for (const seed of seedPlans) {
    const id = `${provider}_${seed.canonicalTierId}_${seed.interval}`;

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
