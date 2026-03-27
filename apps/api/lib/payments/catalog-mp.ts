import { db, plan } from "@beztack/db";
import { eq } from "drizzle-orm";
import type { CatalogPlan } from "./catalog";
import type { Product } from "./types";

/**
 * Fetch all visible plans from the DB and return them as CatalogPlan[]
 */
export async function getCatalogPlans(): Promise<CatalogPlan[]> {
  const plans = await db
    .select()
    .from(plan)
    .where(eq(plan.visible, true))
    .orderBy(plan.displayOrder);

  return plans.map((p) => ({
    id: p.id,
    canonicalTierId: p.canonicalTierId,
    displayName: p.displayName,
    description: p.description,
    features: (p.features as string[] | null) ?? [],
    limits: (p.limits as Record<string, number> | null) ?? {},
    permissions: (p.permissions as string[] | null) ?? [],
    price: {
      amount: Number(p.price),
      currency: p.currency,
    },
    frequency: p.intervalCount ?? 1,
    frequencyType: "months",
    initPoint: null,
    highlighted: p.highlighted ?? false,
    visible: p.visible ?? true,
    displayOrder: p.displayOrder,
  }));
}

/**
 * Fetch a single plan by its ID
 */
export async function getCatalogPlanById(
  planId: string
): Promise<CatalogPlan | null> {
  const [p] = await db.select().from(plan).where(eq(plan.id, planId)).limit(1);

  if (!p) {
    return null;
  }

  return {
    id: p.id,
    canonicalTierId: p.canonicalTierId,
    displayName: p.displayName,
    description: p.description,
    features: (p.features as string[] | null) ?? [],
    limits: (p.limits as Record<string, number> | null) ?? {},
    permissions: (p.permissions as string[] | null) ?? [],
    price: {
      amount: Number(p.price),
      currency: p.currency,
    },
    frequency: p.intervalCount ?? 1,
    frequencyType: "months",
    initPoint: null,
    highlighted: p.highlighted ?? false,
    visible: p.visible ?? true,
    displayOrder: p.displayOrder,
  };
}

/**
 * Fetch a single plan by its provider-side product ID
 */
export async function getCatalogPlanByProviderPlanId(
  providerPlanId: string
): Promise<CatalogPlan | null> {
  const [p] = await db
    .select()
    .from(plan)
    .where(eq(plan.providerPlanId, providerPlanId))
    .limit(1);

  if (!p) {
    return null;
  }

  return {
    id: p.id,
    canonicalTierId: p.canonicalTierId,
    displayName: p.displayName,
    description: p.description,
    features: (p.features as string[] | null) ?? [],
    limits: (p.limits as Record<string, number> | null) ?? {},
    permissions: (p.permissions as string[] | null) ?? [],
    price: {
      amount: Number(p.price),
      currency: p.currency,
    },
    frequency: p.intervalCount ?? 1,
    frequencyType: "months",
    initPoint: null,
    highlighted: p.highlighted ?? false,
    visible: p.visible ?? true,
    displayOrder: p.displayOrder,
  };
}

/**
 * Enrich a provider Product with catalog metadata from DB plan data.
 * Looks up the plan by providerPlanId first, then falls back to plan.id.
 */
export async function enrichProductWithCatalog(
  product: Product
): Promise<Product> {
  let catalogPlan: CatalogPlan | null = null;
  try {
    catalogPlan =
      (await getCatalogPlanByProviderPlanId(product.id)) ??
      (await getCatalogPlanById(product.id));
  } catch {
    // DB may not have the plan table yet — return un-enriched product
    return product;
  }
  if (!catalogPlan) {
    return product;
  }

  const metadata = product.metadata ?? {};
  const tierId = catalogPlan.canonicalTierId ?? product.id;

  return {
    ...product,
    type: "plan" as const,
    metadata: {
      ...metadata,
      planId: tierId,
      tier: tierId,
      features: catalogPlan.features,
      limits: catalogPlan.limits,
      permissions: catalogPlan.permissions,
      displayOrder: catalogPlan.displayOrder,
    },
  };
}
