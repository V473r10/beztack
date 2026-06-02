import type { PaymentProviderAdapter, Subscription } from "@beztack/payments";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMembershipInfo } from "./membership";

const mocks = vi.hoisted(() => ({
  env: {
    PAYMENT_PROVIDER: "mercadopago",
    SUBSCRIPTION_MODE: "organization" as "user" | "organization",
  },
  ensurePaymentProvider: vi.fn(),
  discoverSubscriptionsFromDb: vi.fn(),
  getAdminTierOverrideForMembershipTarget: vi.fn(),
  selectResults: [] as unknown[][],
}));

vi.mock("@/env", () => ({ env: mocks.env }));
vi.mock("@/lib/payments", () => ({
  ensurePaymentProvider: mocks.ensurePaymentProvider,
}));
vi.mock("./subscription-discovery", () => ({
  discoverSubscriptionsFromDb: mocks.discoverSubscriptionsFromDb,
}));
vi.mock("./admin-tier-override", () => ({
  getAdminTierOverrideForMembershipTarget:
    mocks.getAdminTierOverrideForMembershipTarget,
}));
vi.mock("drizzle-orm", () => ({ eq: vi.fn(() => true) }));
vi.mock("@beztack/db", () => ({
  organization: {
    id: "organization.id",
    subscriptionTier: "organization.subscriptionTier",
    subscriptionStatus: "organization.subscriptionStatus",
    subscriptionId: "organization.subscriptionId",
    subscriptionValidUntil: "organization.subscriptionValidUntil",
  },
  user: {
    id: "user.id",
    email: "user.email",
    subscriptionTier: "user.subscriptionTier",
    subscriptionStatus: "user.subscriptionStatus",
    subscriptionId: "user.subscriptionId",
    subscriptionValidUntil: "user.subscriptionValidUntil",
  },
  db: {
    select: vi.fn(() => {
      const result = mocks.selectResults.shift() ?? [];
      return {
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve(result),
          }),
        }),
      };
    }),
  },
}));

const VALID_UNTIL = new Date("2099-06-01T00:00:00.000Z");

function provider(overrides: Partial<PaymentProviderAdapter> = {}) {
  return {
    provider: "mercadopago",
    getSubscription: vi.fn(),
    listSubscriptions: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as PaymentProviderAdapter;
}

function subscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: "sub_1",
    status: "active",
    productId: "plan_pro",
    productName: "Pro",
    customerId: "payer_1",
    customerEmail: "billing@example.com",
    currentPeriodEnd: VALID_UNTIL,
    metadata: { organizationId: "org_1", tier: "pro" },
    ...overrides,
  };
}

function cachedOrganizationMembership(subscriptionId: string | null) {
  return {
    subscriptionTier: "pro",
    subscriptionStatus: "active",
    subscriptionId,
    subscriptionValidUntil: VALID_UNTIL,
  };
}

describe("getMembershipInfo", () => {
  beforeEach(() => {
    mocks.env.PAYMENT_PROVIDER = "mercadopago";
    mocks.env.SUBSCRIPTION_MODE = "organization";
    mocks.ensurePaymentProvider.mockReset();
    mocks.discoverSubscriptionsFromDb.mockReset();
    mocks.discoverSubscriptionsFromDb.mockResolvedValue([]);
    mocks.getAdminTierOverrideForMembershipTarget.mockReset();
    mocks.getAdminTierOverrideForMembershipTarget.mockResolvedValue(null);
    mocks.selectResults.length = 0;
  });

  it("uses an Admin tier override before cached Subscription Membership", async () => {
    mocks.getAdminTierOverrideForMembershipTarget.mockResolvedValue({
      id: 1,
      targetType: "organization",
      targetId: "org_1",
      tier: "ultimate",
      billingCadence: "yearly",
      actorUserId: "admin_1",
      sourceAction: "checkout",
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
      updatedAt: new Date("2026-06-01T00:00:00.000Z"),
    });

    const membership = await getMembershipInfo("user_1", "org_1");

    expect(membership).toMatchObject({
      tier: "ultimate",
      hasActiveSubscription: false,
      organizationId: "org_1",
      source: "admin-tier-override",
    });
    expect(mocks.ensurePaymentProvider).not.toHaveBeenCalled();
  });

  it("trusts cached Mercado Pago Membership after verifying the cached Subscription ID", async () => {
    const paymentProvider = provider({
      getSubscription: vi.fn().mockResolvedValue(subscription()),
    });
    mocks.ensurePaymentProvider.mockResolvedValue(paymentProvider);
    mocks.selectResults.push([cachedOrganizationMembership("sub_1")]);

    const membership = await getMembershipInfo("user_1", "org_1");

    expect(paymentProvider.getSubscription).toHaveBeenCalledWith("sub_1");
    expect(membership).toMatchObject({
      tier: "pro",
      hasActiveSubscription: true,
      subscriptionId: "sub_1",
      organizationId: "org_1",
    });
  });

  it("ignores cached Mercado Pago Membership when the cached Subscription ID cannot be verified", async () => {
    const paymentProvider = provider({
      getSubscription: vi.fn().mockResolvedValue(null),
    });
    mocks.ensurePaymentProvider.mockResolvedValue(paymentProvider);
    mocks.selectResults.push(
      [cachedOrganizationMembership("sub_cross_app")],
      [{ email: "billing@example.com" }]
    );

    const membership = await getMembershipInfo("user_1", "org_1");

    expect(paymentProvider.getSubscription).toHaveBeenCalledWith(
      "sub_cross_app"
    );
    expect(membership).toMatchObject({
      tier: "free",
      hasActiveSubscription: false,
      organizationId: "org_1",
    });
  });

  it("falls back to provider discovery when paid Mercado Pago cache has no Subscription ID", async () => {
    const paymentProvider = provider({
      getSubscription: vi.fn(),
      listSubscriptions: vi.fn().mockResolvedValue([subscription()]),
    });
    mocks.ensurePaymentProvider.mockResolvedValue(paymentProvider);
    mocks.selectResults.push(
      [cachedOrganizationMembership(null)],
      [{ email: "billing@example.com" }]
    );

    const membership = await getMembershipInfo("user_1", "org_1");

    expect(paymentProvider.getSubscription).not.toHaveBeenCalled();
    expect(paymentProvider.listSubscriptions).toHaveBeenCalledWith({
      customerEmail: "billing@example.com",
      limit: 100,
    });
    expect(membership).toMatchObject({
      tier: "pro",
      hasActiveSubscription: true,
      subscriptionId: "sub_1",
      organizationId: "org_1",
    });
  });
});
