/**
 * Canned API data for the mobile layout audit. Everything here is invented:
 * no real emails, ids or provider products.
 */

const NOW = "2026-11-01T12:00:00.000Z";
const RENEWAL = "2026-12-01T12:00:00.000Z";

export const adminUser = {
  id: "user_admin",
  name: "Ada Lovelace",
  email: "ada@example.com",
  emailVerified: true,
  image: null,
  role: "admin",
  banned: false,
  banReason: null,
  banExpires: null,
  twoFactorEnabled: false,
  createdAt: NOW,
  updatedAt: NOW,
};

export const session = {
  id: "session_1",
  userId: adminUser.id,
  token: "e2e-session-token",
  expiresAt: "2027-11-01T12:00:00.000Z",
  ipAddress: "127.0.0.1",
  userAgent: "playwright",
  activeOrganizationId: "org_1",
  createdAt: NOW,
  updatedAt: NOW,
};

export const organization = {
  id: "org_1",
  name: "Ada's workspace",
  slug: "ada",
  logo: null,
  metadata: null,
  createdAt: NOW,
  members: [
    {
      id: "member_1",
      organizationId: "org_1",
      userId: adminUser.id,
      role: "owner",
      createdAt: NOW,
      user: { id: adminUser.id, name: adminUser.name, email: adminUser.email, image: null },
    },
  ],
  invitations: [],
  teams: [],
};

const LONG_USER_EMAIL = "someone.with.a.rather.long.address@subdomain.example.com";

export const users = [
  adminUser,
  {
    ...adminUser,
    id: "user_2",
    name: "Grace Hopper",
    email: "grace@example.com",
    role: "user",
  },
  {
    ...adminUser,
    id: "user_3",
    name: "A Person With A Remarkably Long Display Name",
    email: LONG_USER_EMAIL,
    role: "user",
    banned: true,
    banReason: "Spam",
  },
];

export const membershipStatus = {
  success: true,
  data: {
    userId: adminUser.id,
    tier: "pro",
    hasActiveSubscription: true,
    benefits: [],
    expiresAt: RENEWAL,
    organizationId: organization.id,
    isAppAdmin: true,
    organizationRole: "owner",
    canManageBilling: true,
    billingCadence: "monthly",
    paymentCapabilities: { cadenceChange: true },
  },
};

type TierFixture = {
  id: string;
  name: string;
  monthly: number;
  yearly: number;
  features: string[];
  limits: Record<string, number>;
};

const TIERS: TierFixture[] = [
  {
    id: "basic",
    name: "Basic",
    monthly: 900,
    yearly: 9000,
    features: ["email_support", "basic_analytics"],
    limits: { users: 3, projects: 5 },
  },
  {
    id: "pro",
    name: "Pro",
    monthly: 2900,
    yearly: 29_000,
    features: ["email_support", "advanced_analytics", "priority_support"],
    limits: { users: 10, projects: 25 },
  },
  {
    id: "ultimate",
    name: "Ultimate",
    monthly: 9900,
    yearly: 99_000,
    features: ["email_support", "advanced_analytics", "priority_support", "custom_integrations"],
    limits: { users: 50, projects: 100 },
  },
];

export const products = {
  provider: "polar",
  products: TIERS.flatMap((tier, index) =>
    (["month", "year"] as const).map((interval) => ({
      id: `prod_${tier.id}_${interval}`,
      name: `${tier.name} - ${interval === "month" ? "Monthly" : "Yearly"}`,
      description: `${tier.name} plan`,
      price: { amount: interval === "month" ? tier.monthly : tier.yearly, currency: "USD" },
      interval,
      intervalCount: 1,
      metadata: {
        tier: tier.id,
        planId: tier.id,
        displayOrder: index + 1,
        features: tier.features,
        limits: tier.limits,
      },
    })),
  ),
};

export const subscriptions = {
  provider: "polar",
  subscriptions: [
    {
      id: "sub_1",
      status: "active",
      productId: "prod_pro_month",
      productName: "Pro - Monthly",
      customerId: "cus_1",
      customerEmail: adminUser.email,
      currentPeriodStart: NOW,
      currentPeriodEnd: RENEWAL,
      cancelAtPeriodEnd: false,
      createdAt: NOW,
    },
  ],
};

export const metrics = {
  metrics: [
    { label: "CPU", value: 12, unit: "%", status: "good" },
    { label: "Memory", value: 48, unit: "%", status: "good" },
    { label: "Disk", value: 71, unit: "%", status: "warning" },
  ],
  systemInfo: { node: "v22" },
  timestamp: NOW,
};

export const syncStatus = {
  provider: "polar",
  plans: [],
};

export const failedPlanChanges = {
  total: 1,
  failedPlanChanges: [
    {
      id: "ppc_1",
      subscriptionId: "sub_1",
      direction: "downgrade",
      membershipTarget: { type: "organization", id: organization.id },
      membershipTargetName: organization.name,
      acceptedByEmail: adminUser.email,
      retriedByEmail: null,
      retriedAt: null,
      reason: "Provider rejected the plan change: the subscription is no longer active.",
      activationAttempts: 3,
      effectiveAt: RENEWAL,
      createdAt: NOW,
      failedAt: NOW,
      targetPlanSnapshot: {
        canonicalTierId: "basic",
        billingCadence: "monthly",
        paymentProvider: "polar",
        price: { amount: 900, currency: "USD" },
      },
    },
  ],
};
