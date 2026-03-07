export const CANONICAL_PLAN_IDS = [
  "free",
  "basic",
  "pro",
  "ultimate",
] as const

export type CanonicalPlanId = (typeof CANONICAL_PLAN_IDS)[number]

export type CanonicalPlanDefinition = {
  id: CanonicalPlanId
  name: string
  description: string
  features: string[]
  limits: Record<string, number>
  permissions: string[]
}

export const CANONICAL_PAYMENT_PLANS: Record<
  CanonicalPlanId,
  CanonicalPlanDefinition
> = {
  free: {
    id: "free",
    name: "Free",
    description: "For personal projects and evaluation",
    features: ["basic_dashboard"],
    limits: {
      users: 1,
      projects: 1,
      storage: 1,
      apiCalls: 1000,
    },
    permissions: ["dashboard.read"],
  },
  basic: {
    id: "basic",
    name: "Basic",
    description: "For growing teams",
    features: [
      "basic_dashboard",
      "up_to_5_users",
      "community_support",
      "export_data",
    ],
    limits: {
      users: 5,
      projects: 3,
      storage: 10,
      apiCalls: 10000,
    },
    permissions: [
      "dashboard.read",
      "projects.read",
      "projects.write",
      "billing.read",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    description: "For production teams that need scale",
    features: [
      "basic_dashboard",
      "advanced_analytics",
      "up_to_50_users",
      "priority_support",
      "custom_integrations",
      "export_data",
    ],
    limits: {
      users: 50,
      projects: 25,
      storage: 100,
      apiCalls: 100000,
    },
    permissions: [
      "dashboard.read",
      "projects.read",
      "projects.write",
      "billing.read",
      "billing.write",
      "analytics.read",
    ],
  },
  ultimate: {
    id: "ultimate",
    name: "Ultimate",
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
      apiCalls: 1000000,
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
  },
}

export const CHECKOUT_PLAN_IDS = ["basic", "pro", "ultimate"] as const
export type CheckoutPlanId = (typeof CHECKOUT_PLAN_IDS)[number]
