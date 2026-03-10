/**
 * One-time seed script to populate mpPlan local business fields
 * from the previously hardcoded CANONICAL_PAYMENT_PLANS.
 *
 * Run after schema migration:
 *   pnpm tsx packages/db/scripts/seed-plan-catalog.ts
 *
 * This script updates existing mpPlan rows that match by canonical tier ID
 * (inferred from the plan's `reason` field). It does NOT create new rows —
 * plans must first be synced from Mercado Pago.
 */
import { eq } from "drizzle-orm";
import { db } from "../src/client";
import { mpPlan } from "../src/schema";

type SeedPlan = {
  canonicalTierId: string;
  displayName: string;
  description: string;
  features: string[];
  limits: Record<string, number>;
  permissions: string[];
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

function inferTierFromReason(reason: string): string | null {
  const lower = reason.toLowerCase();
  if (lower.includes("ultimate") || lower.includes("enterprise")) {
    return "ultimate";
  }
  if (lower.includes("pro")) {
    return "pro";
  }
  if (lower.includes("basic")) {
    return "basic";
  }
  if (lower.includes("free")) {
    return "free";
  }
  return null;
}

async function main() {
  console.info("[seed] Starting plan catalog seed...");

  const existingPlans = await db.select().from(mpPlan);
  console.info(`[seed] Found ${existingPlans.length} existing plans in DB`);

  let updated = 0;

  for (const plan of existingPlans) {
    const tierId = plan.canonicalTierId ?? inferTierFromReason(plan.reason);
    if (!tierId) {
      console.info(
        `[seed] Skipping plan "${plan.reason}" (${plan.id}) — no tier match`
      );
      continue;
    }

    const seed = SEED_PLANS.find((s) => s.canonicalTierId === tierId);
    if (!seed) {
      continue;
    }

    await db
      .update(mpPlan)
      .set({
        canonicalTierId: seed.canonicalTierId,
        displayName: seed.displayName,
        description: seed.description,
        features: seed.features,
        limits: seed.limits,
        permissions: seed.permissions,
        displayOrder: seed.displayOrder,
        highlighted: seed.highlighted,
        visible: true,
      })
      .where(eq(mpPlan.id, plan.id));

    updated++;
    console.info(
      `[seed] Updated plan "${plan.reason}" (${plan.id}) → tier: ${tierId}`
    );
  }

  console.info(
    `[seed] Done. Updated ${updated}/${existingPlans.length} plans.`
  );
  process.exit(0);
}

main().catch((error) => {
  console.error("[seed] Error:", error);
  process.exit(1);
});
