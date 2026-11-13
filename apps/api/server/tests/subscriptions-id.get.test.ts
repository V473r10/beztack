import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OrganizationAccess } from "../domain/organization-access/contract";
import { createOrganizationAccessTestModule } from "../domain/organization-access/testing";

const mocks = vi.hoisted(() => ({
  access: undefined as unknown as OrganizationAccess,
  ensurePaymentProvider: vi.fn(),
  getRouterParam: vi.fn(),
  requireAuth: vi.fn(),
  env: {
    SUBSCRIPTION_MODE: "user" as "user" | "organization",
  },
}));

vi.mock("h3", () => ({
  createError(input: { message?: string; statusCode?: number; statusMessage?: string }) {
    return Object.assign(new Error(input.message ?? input.statusMessage ?? "Error"), {
      statusCode: input.statusCode,
    });
  },
  defineEventHandler(handler: unknown) {
    return handler;
  },
  getRouterParam: mocks.getRouterParam,
}));
vi.mock("@/env", () => ({ env: mocks.env }));
vi.mock("@/lib/payments", () => ({
  ensurePaymentProvider: mocks.ensurePaymentProvider,
}));
vi.mock("@/server/utils/membership", () => ({
  requireAuth: mocks.requireAuth,
}));
vi.mock("@/server/domain/organization-access", () => ({
  organizationAccess: {
    canManageBilling: (...args: Parameters<OrganizationAccess["canManageBilling"]>) =>
      mocks.access.canManageBilling(...args),
    ownsSubscription: (...args: Parameters<OrganizationAccess["ownsSubscription"]>) =>
      mocks.access.ownsSubscription(...args),
  },
  OrganizationAccessError: class OrganizationAccessError extends Error {},
}));

const OWNER = { id: "user_owner", email: "owner@example.com", role: "user" };
const STRANGER = { id: "user_other", email: "other@example.com", role: "user" };

/** A Mercado Pago subscription as the Payment provider reports it, owned by OWNER. */
const SUBSCRIPTION = {
  id: "pre_1",
  status: "active",
  productId: "plan_pro",
  productName: "Pro",
  customerId: OWNER.id,
  customerEmail: OWNER.email,
  currentPeriodEnd: new Date("2026-12-13T00:00:00.000Z"),
  metadata: {
    billingAmount: 2900,
    billingCurrency: "USD",
    billingInterval: "month",
    billingFrequency: 1,
    paymentMethodId: "visa",
  },
};

function signIn(user: typeof OWNER, activeOrganizationId: string | null = null) {
  mocks.requireAuth.mockResolvedValue({ user, session: { activeOrganizationId } });
}

async function call() {
  const handler = (await import("../routes/api/subscriptions/[id].get")).default as (
    event: unknown,
  ) => Promise<unknown>;
  return await handler({});
}

describe("GET /api/subscriptions/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.env.SUBSCRIPTION_MODE = "user";
    mocks.access = createOrganizationAccessTestModule({
      appAdminEmails: "admin@example.com",
      memberships: [
        { organizationId: "org_1", userId: OWNER.id, role: "owner" },
        { organizationId: "org_1", userId: STRANGER.id, role: "member" },
      ],
    });
    mocks.getRouterParam.mockReturnValue("pre_1");
    mocks.ensurePaymentProvider.mockResolvedValue({
      provider: "mercadopago",
      getSubscription: vi.fn().mockResolvedValue(SUBSCRIPTION),
    });
  });

  it("returns the subscription to its owner, with the amount in minor units", async () => {
    signIn(OWNER);

    await expect(call()).resolves.toEqual({ provider: "mercadopago", subscription: SUBSCRIPTION });
  });

  it("refuses with 403 a signed-in user who does not own it", async () => {
    signIn(STRANGER);

    await expect(call()).rejects.toMatchObject({ statusCode: 403 });
  });

  it("lets an App admin read any subscription", async () => {
    signIn({ id: "user_admin", email: "admin@example.com", role: "sudo" });

    await expect(call()).resolves.toMatchObject({ subscription: { id: "pre_1" } });
  });

  it("answers 404 when the provider does not know the subscription", async () => {
    signIn(OWNER);
    mocks.ensurePaymentProvider.mockResolvedValue({
      provider: "mercadopago",
      getSubscription: vi.fn().mockResolvedValue(null),
    });

    await expect(call()).rejects.toMatchObject({ statusCode: 404 });
  });

  it("answers the subscription of the active organization to its Billing manager", async () => {
    mocks.env.SUBSCRIPTION_MODE = "organization";
    mocks.ensurePaymentProvider.mockResolvedValue({
      provider: "mercadopago",
      getSubscription: vi
        .fn()
        .mockResolvedValue({ ...SUBSCRIPTION, metadata: { referenceId: "org_1" } }),
    });
    signIn(OWNER, "org_1");

    await expect(call()).resolves.toMatchObject({ subscription: { id: "pre_1" } });
  });

  it("refuses with 403 an organization member who is not a Billing manager", async () => {
    mocks.env.SUBSCRIPTION_MODE = "organization";
    mocks.ensurePaymentProvider.mockResolvedValue({
      provider: "mercadopago",
      getSubscription: vi
        .fn()
        .mockResolvedValue({ ...SUBSCRIPTION, metadata: { referenceId: "org_1" } }),
    });
    signIn(STRANGER, "org_1");

    await expect(call()).rejects.toMatchObject({ statusCode: 403 });
  });
});
