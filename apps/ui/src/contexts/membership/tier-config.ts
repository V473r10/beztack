import type { MembershipTier, MembershipTierConfig } from "@/types/membership";
import type { CatalogPlan, Product } from "./membership-types";

const MONTHS_PER_YEAR = 12;

type DeepMutable<T> = {
  -readonly [P in keyof T]: T[P] extends object ? DeepMutable<T[P]> : T[P];
};

type MutableTierConfig = DeepMutable<MembershipTierConfig>;

function createEmptyTierConfig(
  id: MembershipTier,
  name: string,
  description: string,
): MutableTierConfig {
  return {
    id,
    name,
    description,
    price: { monthly: 0, yearly: 0 },
    features: [],
    limits: {},
    permissions: [],
  };
}

function createInitialTierConfigs(): Record<MembershipTier, MutableTierConfig> {
  return {
    free: createEmptyTierConfig("free", "Free", "Free plan"),
    basic: createEmptyTierConfig("basic", "Basic", "Basic plan"),
    pro: createEmptyTierConfig("pro", "Pro", "Pro plan"),
    ultimate: createEmptyTierConfig("ultimate", "Ultimate", "Ultimate plan"),
  };
}

function isYearlyCatalogPlan(plan: CatalogPlan): boolean {
  return (
    plan.frequencyType === "years" ||
    (plan.frequencyType === "months" && plan.frequency === MONTHS_PER_YEAR)
  );
}

function applyCatalogPlanDetails(tierConfig: MutableTierConfig, plan: CatalogPlan): void {
  tierConfig.name = plan.displayName;

  if (plan.description) {
    tierConfig.description = plan.description;
  }
  if (plan.features.length > 0) {
    tierConfig.features = plan.features;
  }
  if (Object.keys(plan.limits).length > 0) {
    tierConfig.limits = plan.limits;
  }
  if (plan.permissions.length > 0) {
    tierConfig.permissions = plan.permissions;
  }
}

function applyCatalogPlanBilling(tierConfig: MutableTierConfig, plan: CatalogPlan): void {
  // Prices stay integer minor units of their currency (ADR 0007); formatting is `formatPrice`'s job.
  tierConfig.currency ??= plan.price.currency;

  if (isYearlyCatalogPlan(plan)) {
    tierConfig.price.yearly = plan.price.amount;
    tierConfig.yearly = {
      id: plan.id,
      name: plan.displayName,
      description: plan.description ?? undefined,
      price: plan.price.amount,
      currency: plan.price.currency,
      billing_period: "yearly",
    };
    return;
  }

  tierConfig.price.monthly = plan.price.amount;
  tierConfig.monthly = {
    id: plan.id,
    name: plan.displayName,
    description: plan.description ?? undefined,
    price: plan.price.amount,
    currency: plan.price.currency,
    billing_period: "monthly",
  };
}

function applyCatalogPlanToTier(
  tiers: Record<MembershipTier, MutableTierConfig>,
  plan: CatalogPlan,
): void {
  const tierId = plan.canonicalTierId;
  if (!tierId) {
    return;
  }

  const tierConfig = tiers[tierId];
  applyCatalogPlanDetails(tierConfig, plan);
  applyCatalogPlanBilling(tierConfig, plan);
}

function getMetadataStringArray(
  metadata: Record<string, unknown> | undefined,
  key: "features" | "permissions",
): string[] | null {
  const value = metadata?.[key];

  if (!Array.isArray(value)) {
    return null;
  }

  return value.filter((item): item is string => typeof item === "string");
}

function getMetadataLimits(
  metadata: Record<string, unknown> | undefined,
): Record<string, number> | null {
  const limits = metadata?.limits;

  if (!limits || typeof limits !== "object") {
    return null;
  }

  return Object.fromEntries(
    Object.entries(limits).filter(
      (entry): entry is [string, number] =>
        typeof entry[1] === "number" && Number.isFinite(entry[1]),
    ),
  );
}

function applyProductDisplayFallback(tierConfig: MutableTierConfig, product: Product): void {
  if (tierConfig.features.length !== 0) {
    return;
  }

  tierConfig.name = product.name.split(" - ")[0] || tierConfig.name;

  if (product.description) {
    tierConfig.description = product.description;
  }
}

function applyProductBillingFallback(tierConfig: MutableTierConfig, product: Product): void {
  if (product.interval === "month" && !tierConfig.monthly) {
    tierConfig.price.monthly = product.price.amount;
    tierConfig.currency ??= product.price.currency;
    tierConfig.monthly = {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price.amount,
      currency: product.price.currency,
      billing_period: "monthly",
    };
  }

  if (product.interval === "year" && !tierConfig.yearly) {
    tierConfig.price.yearly = product.price.amount;
    tierConfig.currency ??= product.price.currency;
    tierConfig.yearly = {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price.amount,
      currency: product.price.currency,
      billing_period: "yearly",
    };
  }
}

function applyProductMetadataFallback(tierConfig: MutableTierConfig, product: Product): void {
  if (tierConfig.features.length !== 0) {
    return;
  }

  const features = getMetadataStringArray(product.metadata, "features");
  if (features) {
    tierConfig.features = features;
  }

  const permissions = getMetadataStringArray(product.metadata, "permissions");
  if (permissions) {
    tierConfig.permissions = permissions;
  }

  const limits = getMetadataLimits(product.metadata);
  if (limits) {
    tierConfig.limits = limits;
  }
}

function applyProductToTier(
  tiers: Record<MembershipTier, MutableTierConfig>,
  product: Product,
): void {
  const tierId = parseTierIdFromProduct(product);
  const tierConfig = tiers[tierId];

  applyProductDisplayFallback(tierConfig, product);
  applyProductBillingFallback(tierConfig, product);
  applyProductMetadataFallback(tierConfig, product);
}

export function parseTierIdFromName(raw: string | undefined): MembershipTier {
  const name = raw?.toLowerCase() ?? "";

  if (name.includes("ultimate") || name.includes("enterprise")) {
    return "ultimate";
  }
  if (name.includes("pro")) {
    return "pro";
  }
  if (name.includes("basic")) {
    return "basic";
  }

  return "free";
}

export function parseTierIdFromMetadata(
  metadata: Record<string, unknown> | undefined,
): MembershipTier {
  const planId = typeof metadata?.planId === "string" ? metadata.planId : undefined;
  if (planId) {
    return parseTierIdFromName(planId);
  }

  const tier = typeof metadata?.tier === "string" ? metadata.tier : undefined;
  if (tier) {
    return parseTierIdFromName(tier);
  }

  return "free";
}

export function parseTierIdFromProduct(product: Product): MembershipTier {
  const metadataTier = parseTierIdFromMetadata(product.metadata);
  if (metadataTier !== "free") {
    return metadataTier;
  }

  return parseTierIdFromName(product.name);
}

export function buildTierConfigFromPlansAndProducts(
  products: Product[],
  plans: CatalogPlan[] | undefined,
): MembershipTierConfig[] {
  const tiers = createInitialTierConfigs();

  if (plans && plans.length > 0) {
    for (const plan of plans) {
      applyCatalogPlanToTier(tiers, plan);
    }
  }

  for (const product of products) {
    applyProductToTier(tiers, product);
  }

  return Object.values(tiers);
}
