/**
 * The default plan catalog, shared by the plan catalog seed and the demo seed.
 */

export type BaseTier = {
  canonicalTierId: string;
  displayName: string;
  description: string;
  features: string[];
  limits: Record<string, number>;
  permissions: string[];
  displayOrder: number;
  highlighted: boolean;
};

export const BASE_TIERS: BaseTier[] = [
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
    features: ["basic_dashboard", "up_to_5_users", "community_support", "export_data"],
    limits: { users: 5, projects: 3, storage: 10, apiCalls: 10_000 },
    permissions: ["dashboard.read", "projects.read", "projects.write", "billing.read"],
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

/**
 * Prices per provider:
 * - Polar: in cents (900 = $9 USD)
 * - MercadoPago: in display units of the project DEFAULT_CURRENCY
 *   (4500 = 4500 units). Adjust these demo amounts to your currency.
 */
const POLAR_PRICING: Record<string, { monthly: number; yearly: number }> = {
  free: { monthly: 0, yearly: 0 },
  basic: { monthly: 900, yearly: 9000 }, // $9/mo, $90/yr
  pro: { monthly: 2900, yearly: 29_000 }, // $29/mo, $290/yr
  ultimate: { monthly: 9900, yearly: 99_000 }, // $99/mo, $990/yr
};

const MP_PRICING: Record<string, { monthly: number }> = {
  free: { monthly: 0 },
  basic: { monthly: 4500 },
  pro: { monthly: 8000 },
  ultimate: { monthly: 15_000 },
};

export type Interval = "month" | "year";

export type SeedPlan = BaseTier & {
  price: number;
  currency: string;
  interval: Interval;
};

/** The catalog rows for one provider. Polar charges in USD; Mercado Pago in `mercadoPagoCurrency`. */
export function buildSeedPlans(provider: string, mercadoPagoCurrency: string): SeedPlan[] {
  const isMP = provider === "mercadopago";
  const pricing = isMP ? MP_PRICING : POLAR_PRICING;
  const currency = isMP ? mercadoPagoCurrency : "USD";
  const plans: SeedPlan[] = [];

  for (const tier of BASE_TIERS) {
    const prices = pricing[tier.canonicalTierId] ?? { monthly: 0 };

    plans.push({ ...tier, price: prices.monthly, currency, interval: "month" });

    if (!isMP && "yearly" in prices && (prices as { yearly: number }).yearly > 0) {
      plans.push({
        ...tier,
        price: (prices as { yearly: number }).yearly,
        currency,
        interval: "year",
      });
    }
  }

  return plans;
}

/** Plan row id used by the seeds: `<provider>_<tier>_<interval>`. */
export function seedPlanId(provider: string, plan: Pick<SeedPlan, "canonicalTierId" | "interval">) {
  return `${provider}_${plan.canonicalTierId}_${plan.interval}`;
}
