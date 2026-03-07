import {
  CANONICAL_PAYMENT_PLANS,
  type CanonicalPlanId,
  type CheckoutPlanId,
} from "@beztack/db"
import type { Product } from "./types"

export type CanonicalCatalogPlan = {
  id: CanonicalPlanId
  name: string
  description: string
  features: string[]
  limits: Record<string, number>
  permissions: string[]
  prices: {
    monthly?: {
      productId: string
      amount: number
      currency: string
    }
    yearly?: {
      productId: string
      amount: number
      currency: string
    }
  }
}

function normalizeTierId(raw: string): CanonicalPlanId | null {
  const normalized = raw.trim().toLowerCase()

  if (normalized.includes("ultimate") || normalized.includes("enterprise")) {
    return "ultimate"
  }
  if (normalized.includes("pro")) {
    return "pro"
  }
  if (normalized.includes("basic")) {
    return "basic"
  }
  if (normalized.includes("free")) {
    return "free"
  }

  return null
}

export function inferCanonicalPlanId(
  product: Product
): CanonicalPlanId | null {
  const metadata = product.metadata

  const planId =
    typeof metadata?.planId === "string" ? metadata.planId : undefined
  if (planId) {
    const normalized = normalizeTierId(planId)
    if (normalized) {
      return normalized
    }
  }

  const tier =
    typeof metadata?.tier === "string" ? metadata.tier : undefined
  if (tier) {
    const normalized = normalizeTierId(tier)
    if (normalized) {
      return normalized
    }
  }

  return normalizeTierId(product.name)
}

export function enrichProductWithCatalog(product: Product): Product {
  const planId = inferCanonicalPlanId(product)
  if (!planId) {
    return product
  }

  const canonical = CANONICAL_PAYMENT_PLANS[planId]
  const metadata = product.metadata ?? {}

  return {
    ...product,
    metadata: {
      ...metadata,
      planId,
      tier: planId,
      features: canonical.features,
      limits: canonical.limits,
      permissions: canonical.permissions,
    },
  }
}

export function buildCanonicalCatalog(
  products: Product[]
): CanonicalCatalogPlan[] {
  const catalog: Record<CanonicalPlanId, CanonicalCatalogPlan> = {
    free: {
      ...CANONICAL_PAYMENT_PLANS.free,
      prices: {},
    },
    basic: {
      ...CANONICAL_PAYMENT_PLANS.basic,
      prices: {},
    },
    pro: {
      ...CANONICAL_PAYMENT_PLANS.pro,
      prices: {},
    },
    ultimate: {
      ...CANONICAL_PAYMENT_PLANS.ultimate,
      prices: {},
    },
  }

  for (const product of products) {
    const planId = inferCanonicalPlanId(product)
    if (!planId) {
      continue
    }

    const entry = catalog[planId]
    if (product.interval === "month") {
      entry.prices.monthly = {
        productId: product.id,
        amount: product.price.amount,
        currency: product.price.currency,
      }
    }

    if (product.interval === "year") {
      entry.prices.yearly = {
        productId: product.id,
        amount: product.price.amount,
        currency: product.price.currency,
      }
    }
  }

  return Object.values(catalog)
}

export function resolveProductByCanonicalPlan(
  products: Product[],
  planId: CheckoutPlanId,
  billingPeriod: "monthly" | "yearly"
): Product | null {
  const expectedInterval = billingPeriod === "yearly" ? "year" : "month"

  for (const product of products) {
    if (product.interval !== expectedInterval) {
      continue
    }

    const productPlanId = inferCanonicalPlanId(product)
    if (productPlanId === planId) {
      return product
    }
  }

  return null
}
