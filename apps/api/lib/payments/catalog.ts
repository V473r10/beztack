import { db, mpPlan } from "@beztack/db";
import { eq } from "drizzle-orm";
import type { Product } from "./types";

export type CatalogPlan = {
  id: string;
  canonicalTierId: string | null;
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
    canonicalTierId: plan.canonicalTierId ?? null,
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
    canonicalTierId: plan.canonicalTierId ?? null,
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
 * Looks up the plan by product ID and uses DB canonicalTierId directly.
 */
export async function enrichProductWithCatalog(
  product: Product
): Promise<Product> {
  const plan = await getCatalogPlanById(product.id);
  if (!plan) {
    return product;
  }

  const metadata = product.metadata ?? {};
  const tierId = plan.canonicalTierId ?? product.id;

  return {
    ...product,
    metadata: {
      ...metadata,
      planId: tierId,
      tier: tierId,
      features: plan.features,
      limits: plan.limits,
      permissions: plan.permissions,
      displayOrder: plan.displayOrder,
    },
  };
}

/**
 * Resolve a product by canonical tier and billing period
 * Uses the tier/planId from product metadata (enriched from DB)
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

    const productPlanId =
      typeof product.metadata?.planId === "string"
        ? product.metadata.planId
        : undefined;
    if (productPlanId === planId) {
      return product;
    }
  }

  return null;
}
