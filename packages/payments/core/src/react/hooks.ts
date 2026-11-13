/**
 * Provider-agnostic React hooks for payments
 */

import type { PricingTier, Product, ProviderProduct } from "../types.js";

const PERCENT_SCALE = 100;

type ProductsResponse = {
  provider: string;
  products: Product[];
};

function getTierId(product: Product): string {
  const tierId = typeof product.metadata?.tier === "string" ? product.metadata.tier : undefined;
  if (tierId) {
    return tierId;
  }

  const planId = typeof product.metadata?.planId === "string" ? product.metadata.planId : undefined;
  if (planId) {
    return planId;
  }

  return product.id;
}

const TIER_ORDER: Record<string, number> = {
  free: 0,
  basic: 1,
  pro: 2,
  ultimate: 3,
};

function getDisplayOrder(product: Product): number {
  const displayOrder = product.metadata?.displayOrder;
  if (typeof displayOrder === "number") {
    return displayOrder;
  }
  const tierId = getTierId(product);
  return TIER_ORDER[tierId] ?? 0;
}

function extractPermissions(
  metadata: Record<string, unknown> | undefined,
): Record<string, boolean> {
  if (Array.isArray(metadata?.permissions)) {
    return Object.fromEntries(
      metadata.permissions
        .filter((value): value is string => typeof value === "string")
        .map((permission) => [permission, true]),
    );
  }
  if (metadata?.permissions && typeof metadata.permissions === "object") {
    return metadata.permissions as Record<string, boolean>;
  }
  return {};
}

function buildProviderProduct(product: Product, interval: string): ProviderProduct {
  return {
    id: product.id,
    name: product.name,
    description: product.description ?? null,
    recurringInterval: interval,
    metadata: product.metadata,
    prices: [
      {
        id: product.id,
        priceAmount: product.price.amount,
        priceCurrency: product.price.currency,
        recurringInterval: interval,
      },
    ],
  };
}

function buildBaseTier(product: Product, tierId: string, displayOrder: number): PricingTier {
  const metadata = product.metadata;
  const baseName = product.name.split(" - ")[0] || product.name;
  const features = Array.isArray(metadata?.features)
    ? metadata.features.filter((value): value is string => typeof value === "string")
    : [];
  const limits =
    metadata?.limits && typeof metadata.limits === "object"
      ? (metadata.limits as Record<string, number>)
      : {};
  const permissions = extractPermissions(metadata);

  return {
    id: tierId,
    name: baseName,
    description: product.description || `${baseName} tier`,
    price: { monthly: 0, yearly: 0 },
    currency: product.price.currency,
    features,
    limits,
    permissions,
    displayOrder,
    soon: metadata?.soon === true,
    ...(metadata?.catalogOnly === true ? { catalogOnly: true } : {}),
  };
}

/**
 * The leading words two product names share ("Basic Yearly" and "Basic Monthly" share "Basic").
 * A tier is named after its products without the billing period; with nothing in common the
 * first name stays.
 */
function sharedLeadingWords(current: string, other: string): string {
  const left = current.split(" ");
  const right = other.split(" ");
  const shared: string[] = [];
  for (const [index, word] of left.entries()) {
    if (word !== right[index]) {
      break;
    }
    shared.push(word);
  }
  return shared.length > 0 ? shared.join(" ") : current;
}

/** Tier prices stay in the product's integer minor units (ADR 0007); formatting is the UI's job. */
function applyIntervalToTier(tier: PricingTier, product: Product): PricingTier {
  const amount = product.price.amount;

  if (product.interval === "month") {
    return {
      ...tier,
      price: { ...tier.price, monthly: amount },
      monthly: buildProviderProduct(product, "month"),
    };
  }

  if (product.interval === "year") {
    return {
      ...tier,
      price: { ...tier.price, yearly: amount },
      yearly: buildProviderProduct(product, "year"),
    };
  }

  return tier;
}

/**
 * Fetch products from the API and transform them into PricingTier objects.
 * This is a queryFn — use it with @tanstack/react-query's useQuery.
 */
export async function fetchPricingTiers(apiUrl: string): Promise<PricingTier[]> {
  const response = await fetch(`${apiUrl}/api/subscriptions/products`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const payload = (await response.json()) as ProductsResponse;
  const tiers = new Map<string, PricingTier>();

  for (const product of payload.products) {
    const tierId = getTierId(product);
    const displayOrder = getDisplayOrder(product);
    const existing = tiers.get(tierId);
    const baseTier = existing ?? buildBaseTier(product, tierId, displayOrder);
    const otherName = product.name.split(" - ")[0] || product.name;
    const named = existing
      ? { ...baseTier, name: sharedLeadingWords(baseTier.name, otherName) }
      : baseTier;
    const updated = applyIntervalToTier(named, product);
    tiers.set(tierId, updated);
  }

  for (const [id, tier] of tiers) {
    if (tier.price.monthly > 0 && tier.price.yearly > 0) {
      const annualIfMonthly = tier.price.monthly * 12;
      const pct = ((annualIfMonthly - tier.price.yearly) / annualIfMonthly) * PERCENT_SCALE;
      tiers.set(id, { ...tier, yearlySavingsPercent: Math.round(pct) });
    }
  }

  // Array.prototype.sort is stable, so equal displayOrder keeps the provider order.
  return Array.from(tiers.values()).sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
}
