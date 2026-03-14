/**
 * Seed script to populate the plan catalog with default tier data.
 *
 * Run after schema migration:
 *   pnpm tsx packages/db/scripts/seed-plan-catalog.ts
 *
 * This script upserts plans by canonical tier ID + provider.
 */
import { and, eq } from "drizzle-orm";
import { db } from "../src/client";
import { plan } from "../src/schema";

type SeedPlan = {
  canonicalTierId: string;
  displayName: string;
  description: string;
  features: string[];
  limits: Record<string, number>;
  permissions: string[];
  price: number;
  currency: string;
  interval: string;
  displayOrder: number;
  highlighted: boolean;
};

const SEED_PLANS: SeedPlan[] = [
  {
    canonicalTierId: "free",
    displayName: "Free",
    description: "For personal projects and evaluation",
    features: ["basic_dashboard"],
    limits: { users: 1, projects: 1, storage: 1, apiCalls: 1000 },
    permissions: ["dashboard.read"],
    price: 0,
    currency: "USD",
    interval: "month",
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
    price: 900,
    currency: "USD",
    interval: "month",
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
    price: 2900,
    currency: "USD",
    interval: "month",
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
    price: 9900,
    currency: "USD",
    interval: "month",
    displayOrder: 3,
    highlighted: false,
  },
];

async function main() {
  const provider = process.argv[2] ?? "polar";
  // biome-ignore lint/suspicious/noConsole: seed script
  console.info(`[seed] Starting plan catalog seed for provider: ${provider}`);

  let upserted = 0;

  for (const seed of SEED_PLANS) {
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
