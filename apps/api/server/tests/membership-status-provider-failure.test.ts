import type { PaymentProviderAdapter, Subscription } from "@beztack/payments";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createOrganizationAccessTestModule } from "@/server/domain/organization-access/testing";

const mocks = vi.hoisted(() => ({
  getQuery: vi.fn(),
  requireAuth: vi.fn(),
  env: {
    PAYMENT_PROVIDER: "mercadopago" as "mercadopago" | "polar",
    SUBSCRIPTION_MODE: "organization" as "user" | "organization",
  },
  access: { current: undefined as unknown },
  provider: { current: undefined as unknown },
  getAdminTierOverrideForMembershipTarget: vi.fn(),
  discoverSubscriptionsFromDb: vi.fn(),
  selectResults: [] as unknown[][],
}));

vi.mock("h3", () => ({
  createError(input: { statusCode?: number; statusMessage?: string }) {
    return Object.assign(new Error(input.statusMessage ?? "Error"), input);
  },
  defineEventHandler(handler: unknown) {
    return handler;
  },
  getQuery: mocks.getQuery,
}));
vi.mock("@/env", () => ({ env: mocks.env }));
vi.mock("@/lib/payments", () => ({
  ensurePaymentProvider: async () => mocks.provider.current,
}));
vi.mock("@/server/utils/subscription-discovery", () => ({
  discoverSubscriptionsFromDb: mocks.discoverSubscriptionsFromDb,
}));
vi.mock("@/server/utils/admin-tier-override", () => ({
  getAdminTierOverrideForMembershipTarget: mocks.getAdminTierOverrideForMembershipTarget,
}));
vi.mock("drizzle-orm", () => ({ eq: vi.fn(() => true) }));
vi.mock("@beztack/db", () => ({
  organization: { id: "organization.id" },
  user: { id: "user.id", email: "user.email" },
  db: {
    select: vi.fn(() => {
      const result = mocks.selectResults.shift() ?? [];
      return { from: () => ({ where: () => ({ limit: () => Promise.resolve(result) }) }) };
    }),
  },
}));
vi.mock("@/server/domain/organization-access", async () => ({
  ...(await vi.importActual<typeof import("@/server/domain/organization-access/contract")>(
    "@/server/domain/organization-access/contract",
  )),
  get organizationAccess() {
    return mocks.access.current;
  },
}));
// The route reads the real Membership; only the session is faked.
vi.mock("@/server/utils/membership", async (importActual) => ({
  ...(await importActual<typeof import("@/server/utils/membership")>()),
  requireAuth: mocks.requireAuth,
}));

const handler = (await import("@/server/routes/api/membership/status.get")).default as (
  event: unknown,
) => Promise<{ data: { tier: string; hasActiveSubscription: boolean } }>;

const VALID_UNTIL = new Date("2099-06-01T00:00:00.000Z");

class ProviderError extends Error {
  readonly statusCode: number;
  constructor(statusCode: number) {
    super(`provider answered ${statusCode}`);
    this.statusCode = statusCode;
  }
}

function failingProvider(statusCode: number) {
  const fail = vi.fn().mockRejectedValue(new ProviderError(statusCode));
  mocks.provider.current = {
    provider: mocks.env.PAYMENT_PROVIDER,
    capabilities: { cadenceChange: false },
    getSubscription: fail,
    listSubscriptions: fail,
  } as unknown as PaymentProviderAdapter;
}

function projectedOrganization(overrides: Record<string, unknown> = {}) {
  return {
    subscriptionTier: "pro",
    subscriptionStatus: "active",
    subscriptionId: "sub_1",
    subscriptionValidUntil: VALID_UNTIL,
    subscriptionBillingCadence: "monthly",
    ...overrides,
  };
}

async function failureOf(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error as { statusCode?: number; data?: { code?: string } };
  }
  return null;
}

describe("GET /api/membership/status when the Payment provider fails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.env.PAYMENT_PROVIDER = "mercadopago";
    mocks.env.SUBSCRIPTION_MODE = "organization";
    mocks.selectResults.length = 0;
    mocks.getQuery.mockReturnValue({});
    mocks.getAdminTierOverrideForMembershipTarget.mockResolvedValue(null);
    mocks.discoverSubscriptionsFromDb.mockResolvedValue([]);
    mocks.requireAuth.mockResolvedValue({
      user: { id: "user_owner", email: "owner@example.com", role: "user" },
      session: { activeOrganizationId: "org_1" },
    });
    mocks.access.current = createOrganizationAccessTestModule({
      memberships: [{ organizationId: "org_1", userId: "user_owner", role: "owner" }],
    });
  });

  it("answers the projected Membership when the provider rate-limits the check", async () => {
    failingProvider(429);
    mocks.selectResults.push([projectedOrganization()]);

    await expect(handler({})).resolves.toMatchObject({
      data: { tier: "pro", hasActiveSubscription: true },
    });
  });

  it("answers 503 provider_unavailable, never free, when there is no projected Membership", async () => {
    failingProvider(429);
    mocks.selectResults.push([{ subscriptionTier: null }], [{ email: "owner@example.com" }]);

    const failure = await failureOf(handler({}));

    expect(failure).toMatchObject({ statusCode: 503, data: { code: "provider_unavailable" } });
  });

  it("answers 503 provider_unavailable when the provider fails with a server error", async () => {
    mocks.env.PAYMENT_PROVIDER = "polar";
    mocks.env.SUBSCRIPTION_MODE = "user";
    failingProvider(500);
    mocks.selectResults.push([{ subscriptionTier: null }], [{ email: "owner@example.com" }]);

    const failure = await failureOf(handler({}));

    expect(failure).toMatchObject({ statusCode: 503, data: { code: "provider_unavailable" } });
  });

  it("still answers free when the provider answers and the customer has no Subscription", async () => {
    mocks.provider.current = {
      provider: "mercadopago",
      capabilities: { cadenceChange: false },
      getSubscription: vi.fn(),
      listSubscriptions: vi.fn().mockResolvedValue([] as Subscription[]),
    };
    mocks.selectResults.push([{ subscriptionTier: null }], [{ email: "owner@example.com" }]);

    await expect(handler({})).resolves.toMatchObject({
      data: { tier: "free", hasActiveSubscription: false },
    });
  });
});
