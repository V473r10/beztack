import { db, mpPlan } from "@beztack/db";
import { eq } from "drizzle-orm";
import type { Product } from "./types";

export type CanonicalTierId = "free" | "basic" | "pro" | "ultimate";

export type CatalogPlan = {
  id: string;
  canonicalTierId: CanonicalTierId | null;
  displayName: string;
  description: string | null;
  features: string[];
  limits: Record<string, number>;
  permissions: string[];
  price: {
    amount: number;
    currency: string;
  };
  frequency: number;
  frequencyType: string;
  initPoint: string | null;
  highlighted: boolean;
  visible: boolean;
  displayOrder: number | null;
};

const TIER_IDS = ["free", "basic", "pro", "ultimate"] as const;

function isTierId(value: string): value is CanonicalTierId {
  return (TIER_IDS as readonly string[]).includes(value);
}

function normalizeTierId(raw: string): CanonicalTierId | null {
  const normalized = raw.trim().toLowerCase();

  if (normalized.includes("ultimate") || normalized.includes("enterprise")) {
    return "ultimate";
  }
  if (normalized.includes("pro")) {
    return "pro";
  }
  if (normalized.includes("basic")) {
    return "basic";
  }
  if (normalized.includes("free")) {
    return "free";
  }

  return null;
}

export function inferCanonicalPlanId(product: Product): CanonicalTierId | null {
  const metadata = product.metadata;

  const planId =
    typeof metadata?.planId === "string" ? metadata.planId : undefined;
  if (planId) {
    const normalized = normalizeTierId(planId);
    if (normalized) {
      return normalized;
    }
  }

  const tier = typeof metadata?.tier === "string" ? metadata.tier : undefined;
  if (tier) {
    const normalized = normalizeTierId(tier);
    if (normalized) {
      return normalized;
    }
  }

  return normalizeTierId(product.name);
}

/**
 * Fetch all visible plans from the DB and return them as CatalogPlan[]
 */
export async function getCatalogPlans(): Promise<CatalogPlan[]> {
  const plans = await db
    .select()
    .from(mpPlan)
    .where(eq(mpPlan.visible, true))
    .orderBy(mpPlan.displayOrder);

  return plans.map((plan) => ({
    id: plan.id,
    canonicalTierId:
      plan.canonicalTierId && isTierId(plan.canonicalTierId)
        ? plan.canonicalTierId
        : null,
    displayName: plan.displayName ?? plan.reason,
    description: plan.description,
    features: (plan.features as string[] | null) ?? [],
    limits: (plan.limits as Record<string, number> | null) ?? {},
    permissions: (plan.permissions as string[] | null) ?? [],
    price: {
      amount: Number(plan.transactionAmount),
      currency: plan.currencyId,
    },
    frequency: plan.frequency,
    frequencyType: plan.frequencyType,
    initPoint: plan.initPoint,
    highlighted: plan.highlighted ?? false,
    visible: plan.visible ?? true,
    displayOrder: plan.displayOrder,
  }));
}

/**
 * Fetch a single plan by its MP ID
 */
export async function getCatalogPlanById(
  planId: string
): Promise<CatalogPlan | null> {
  const [plan] = await db
    .select()
    .from(mpPlan)
    .where(eq(mpPlan.id, planId))
    .limit(1);

  if (!plan) {
    return null;
  }

  return {
    id: plan.id,
    canonicalTierId:
      plan.canonicalTierId && isTierId(plan.canonicalTierId)
        ? plan.canonicalTierId
        : null,
    displayName: plan.displayName ?? plan.reason,
    description: plan.description,
    features: (plan.features as string[] | null) ?? [],
    limits: (plan.limits as Record<string, number> | null) ?? {},
    permissions: (plan.permissions as string[] | null) ?? [],
    price: {
      amount: Number(plan.transactionAmount),
      currency: plan.currencyId,
    },
    frequency: plan.frequency,
    frequencyType: plan.frequencyType,
    initPoint: plan.initPoint,
    highlighted: plan.highlighted ?? false,
    visible: plan.visible ?? true,
    displayOrder: plan.displayOrder,
  };
}

/**
 * Enrich a provider Product with catalog metadata from DB plan data.
 * Falls back to name-based tier inference if no DB match.
 */
export async function enrichProductWithCatalog(
  product: Product
): Promise<Product> {
  const tierId = inferCanonicalPlanId(product);
  if (!tierId) {
    return product;
  }

  const plans = await getCatalogPlans();
  const matchingPlan = plans.find((p) => p.canonicalTierId === tierId);

  const metadata = product.metadata ?? {};

  return {
    ...product,
    metadata: {
      ...metadata,
      planId: tierId,
      tier: tierId,
      features: matchingPlan?.features ?? [],
      limits: matchingPlan?.limits ?? {},
      permissions: matchingPlan?.permissions ?? [],
    },
  };
}

/**
 * Resolve a product by canonical tier and billing period
 */
export function resolveProductByCanonicalPlan(
  products: Product[],
  planId: string,
  billingPeriod: "monthly" | "yearly"
): Product | null {
  const expectedInterval = billingPeriod === "yearly" ? "year" : "month";

  for (const product of products) {
    if (product.interval !== expectedInterval) {
      continue;
    }

    const productPlanId = inferCanonicalPlanId(product);
    if (productPlanId === planId) {
      return product;
    }
  }

  return null;
}
