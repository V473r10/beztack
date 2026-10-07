import { beforeEach, describe, expect, it, vi } from "vitest";
import { createOrganizationAccessTestModule } from "@/server/domain/organization-access/testing";

const mocks = vi.hoisted(() => ({
  getQuery: vi.fn(),
  requireAuth: vi.fn(),
  env: { SUBSCRIPTION_MODE: "organization" as "user" | "organization" },
  access: { current: undefined as unknown },
  capabilities: { cadenceChange: false },
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
  ensurePaymentProvider: async () => ({ capabilities: mocks.capabilities }),
}));
vi.mock("@/server/utils/membership", () => ({
  requireAuth: mocks.requireAuth,
  getUserMembershipStatus: vi.fn(async (_userId: string, organizationId?: string) => ({
    tier: "basic",
    billingCadence: "monthly",
    organizationId,
  })),
}));
vi.mock("@/server/domain/organization-access", async () => ({
  ...(await vi.importActual<typeof import("@/server/domain/organization-access/contract")>(
    "@/server/domain/organization-access/contract",
  )),
  get organizationAccess() {
    return mocks.access.current;
  },
}));

const handler = (await import("@/server/routes/api/membership/status.get")).default as (
  event: unknown,
) => Promise<{ data: { organizationRole: string | null; canManageBilling: boolean } }>;

function signIn(userId: string, role = "user") {
  mocks.requireAuth.mockResolvedValue({
    user: { id: userId, email: `${userId}@example.com`, role },
    session: { activeOrganizationId: "org_1" },
  });
}

async function statusOf(promise: Promise<unknown>): Promise<number> {
  try {
    await promise;
    return 200;
  } catch (error) {
    return (error as { statusCode?: number }).statusCode ?? 500;
  }
}

describe("GET /api/membership/status access fields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.env.SUBSCRIPTION_MODE = "organization";
    mocks.getQuery.mockReturnValue({});
    mocks.capabilities = { cadenceChange: false };
    mocks.access.current = createOrganizationAccessTestModule({
      appAdminEmails: "user_operator@example.com",
      memberships: [
        { organizationId: "org_1", userId: "user_owner", role: "owner" },
        { organizationId: "org_1", userId: "user_member", role: "member" },
      ],
    });
  });

  it("reports the Organization role and the Billing manager gate", async () => {
    signIn("user_owner");
    await expect(handler({})).resolves.toMatchObject({
      data: { organizationRole: "owner", canManageBilling: true },
    });

    signIn("user_member");
    await expect(handler({})).resolves.toMatchObject({
      data: { organizationRole: "member", canManageBilling: false },
    });
  });

  it("gives an App admin billing access but no Organization role", async () => {
    signIn("user_operator", "sudo");

    await expect(handler({})).resolves.toMatchObject({
      data: { organizationRole: null, canManageBilling: true },
    });
  });

  it("refuses another Organization's status to a non-member", async () => {
    signIn("user_member");
    mocks.getQuery.mockReturnValue({ organizationId: "org_2" });

    expect(await statusOf(handler({}))).toBe(403);
  });

  it("lets everyone manage their own billing in user mode", async () => {
    mocks.env.SUBSCRIPTION_MODE = "user";
    signIn("user_member");

    await expect(handler({})).resolves.toMatchObject({ data: { canManageBilling: true } });
  });

  it("reports the Billing cadence and what the Payment provider can do", async () => {
    signIn("user_owner");
    await expect(handler({})).resolves.toMatchObject({
      data: { billingCadence: "monthly", paymentCapabilities: { cadenceChange: false } },
    });

    mocks.capabilities = { cadenceChange: true };
    await expect(handler({})).resolves.toMatchObject({
      data: { paymentCapabilities: { cadenceChange: true } },
    });
  });
});
