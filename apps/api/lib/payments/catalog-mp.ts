import { db, plan } from "@beztack/db";
import { and, eq } from "drizzle-orm";
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
      amount: p.price,
      currency: p.currency,
    },
    frequency: p.intervalCount ?? 1,
    frequencyType: "months",
    initPoint: null,
    highlighted: p.highlighted ?? false,
    soon: p.soon,
    visible: p.visible ?? true,
    displayOrder: p.displayOrder,
  }));
}

type PlanRow = typeof plan.$inferSelect;

/** A catalog row shaped like the provider's own product. Null for an interval the pricing page cannot show. */
function toCatalogProduct(row: PlanRow): Product | null {
  if (!(row.interval === "month" || row.interval === "year")) {
    return null;
  }

  return {
    id: row.providerPlanId ?? row.id,
    name: row.displayName,
    description: row.description ?? undefined,
    type: "plan",
    price: {
      amount: row.price,
      currency: row.currency,
    },
    interval: row.interval,
    intervalCount: row.intervalCount ?? 1,
    metadata: {
      planId: row.canonicalTierId,
      tier: row.canonicalTierId,
      features: (row.features as string[] | null) ?? [],
      limits: (row.limits as Record<string, number> | null) ?? {},
      permissions: (row.permissions as string[] | null) ?? [],
      displayOrder: row.displayOrder,
      soon: row.soon,
      // No product at the provider behind this row (Free, or not synced yet).
      catalogOnly: row.providerPlanId === null,
    },
  };
}

function visibleActivePlans(paymentProvider: string) {
  return db
    .select()
    .from(plan)
    .where(
      and(eq(plan.provider, paymentProvider), eq(plan.visible, true), eq(plan.status, "active")),
    )
    .orderBy(plan.displayOrder);
}

/**
 * The active visible Pricing catalog plans of a Payment provider, shaped like
 * the provider's own products (same id, price and interval) so the pricing
 * page and checkout treat them the same. Used when the provider is down.
 */
export async function getCatalogProducts(paymentProvider: string): Promise<Product[]> {
  const rows = await visibleActivePlans(paymentProvider);

  return rows.flatMap((row) => toCatalogProduct(row) ?? []);
}

/**
 * The visible catalog plans that have no product at the Payment provider, like
 * Free. They are listed next to the provider's products so the pricing page can
 * show them; they are never bought through checkout.
 */
export async function getCatalogOnlyProducts(paymentProvider: string): Promise<Product[]> {
  const rows = await visibleActivePlans(paymentProvider);

  return rows.flatMap((row) => (row.providerPlanId === null ? (toCatalogProduct(row) ?? []) : []));
}

/**
 * Fetch a single plan by its ID
 */
export async function getCatalogPlanById(planId: string): Promise<CatalogPlan | null> {
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
      amount: p.price,
      currency: p.currency,
    },
    frequency: p.intervalCount ?? 1,
    frequencyType: "months",
    initPoint: null,
    highlighted: p.highlighted ?? false,
    soon: p.soon,
    visible: p.visible ?? true,
    displayOrder: p.displayOrder,
  };
}

/**
 * Fetch a single plan by its provider-side product ID
 */
export async function getCatalogPlanByProviderPlanId(
  providerPlanId: string,
): Promise<CatalogPlan | null> {
  const [p] = await db.select().from(plan).where(eq(plan.providerPlanId, providerPlanId)).limit(1);

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
      amount: p.price,
      currency: p.currency,
    },
    frequency: p.intervalCount ?? 1,
    frequencyType: "months",
    initPoint: null,
    highlighted: p.highlighted ?? false,
    soon: p.soon,
    visible: p.visible ?? true,
    displayOrder: p.displayOrder,
  };
}

/**
 * Enrich a provider Product with catalog metadata from DB plan data.
 * Looks up the plan by providerPlanId first, then falls back to plan.id.
 */
export async function enrichProductWithCatalog(product: Product): Promise<Product> {
  let catalogPlan: CatalogPlan | null = null;
  try {
    catalogPlan =
      (await getCatalogPlanByProviderPlanId(product.id)) ?? (await getCatalogPlanById(product.id));
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
      soon: catalogPlan.soon,
    },
  };
}
