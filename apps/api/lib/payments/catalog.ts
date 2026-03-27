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

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function getNumberRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, number] =>
        typeof entry[1] === "number" && Number.isFinite(entry[1])
    )
  );
}

function mapIntervalToFrequencyType(
  interval: Product["interval"]
): CatalogPlan["frequencyType"] {
  switch (interval) {
    case "year":
      return "years";
    case "week":
      return "weeks";
    case "day":
      return "days";
    default:
      return "months";
  }
}

export function buildCatalogPlanFromProduct(product: Product): CatalogPlan {
  const metadata = product.metadata;
  const canonicalTierId =
    typeof metadata?.planId === "string"
      ? metadata.planId
      : typeof metadata?.tier === "string"
        ? metadata.tier
        : null;

  return {
    id: product.id,
    canonicalTierId,
    displayName: product.name,
    description: product.description ?? null,
    features: getStringArray(metadata?.features),
    limits: getNumberRecord(metadata?.limits),
    permissions: getStringArray(metadata?.permissions),
    price: {
      amount: product.price.amount,
      currency: product.price.currency,
    },
    frequency: product.intervalCount,
    frequencyType: mapIntervalToFrequencyType(product.interval),
    initPoint: null,
    highlighted: metadata?.highlighted === true,
    visible: metadata?.visible !== false,
    displayOrder:
      typeof metadata?.displayOrder === "number" ? metadata.displayOrder : null,
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
