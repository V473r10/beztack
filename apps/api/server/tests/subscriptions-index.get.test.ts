import { beforeEach, describe, expect, it, vi } from "vitest";
import { createOrganizationAccessTestModule } from "@/server/domain/organization-access/testing";

const mocks = vi.hoisted(() => ({
  ensurePaymentProvider: vi.fn(),
  getQuery: vi.fn(),
  requireAuth: vi.fn(),
  env: { SUBSCRIPTION_MODE: "organization" as "user" | "organization" },
  access: { current: undefined as unknown },
}));

vi.mock("h3", () => ({
  createError(input: { statusCode?: number; statusMessage?: string; message?: string }) {
    return Object.assign(new Error(input.statusMessage ?? input.message ?? "Error"), input);
  },
  defineEventHandler(handler: unknown) {
    return handler;
  },
  getQuery: mocks.getQuery,
}));
vi.mock("@/env", () => ({ env: mocks.env }));
vi.mock("@/lib/payments", () => ({ ensurePaymentProvider: mocks.ensurePaymentProvider }));
vi.mock("@/server/utils/membership", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/server/utils/subscription-discovery", () => ({
  discoverSubscriptionsFromDb: vi.fn(async () => []),
}));
// The real module on an in-memory world instead of the database.
vi.mock("@/server/domain/organization-access", async () => {
  const contract = await vi.importActual<
    typeof import("@/server/domain/organization-access/contract")
  >("@/server/domain/organization-access/contract");
  return {
    ...contract,
    get organizationAccess() {
      return mocks.access.current;
    },
  };
});

const handler = (await import("@/server/routes/api/subscriptions/index.get")).default as (
  event: unknown,
) => Promise<{ subscriptions: unknown[] }>;

const ORG_SUBSCRIPTION = {
  id: "sub_org_1",
  status: "active",
  productId: "plan_pro",
  customerId: "provider-customer",
  metadata: { referenceId: "org_1" },
};

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

describe("GET /api/subscriptions (organization mode)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getQuery.mockReturnValue({});
    mocks.ensurePaymentProvider.mockResolvedValue({
      provider: "polar",
      listSubscriptions: vi.fn(async () => [ORG_SUBSCRIPTION]),
    });
    mocks.access.current = createOrganizationAccessTestModule({
      appAdminEmails: "user_operator@example.com",
      memberships: [
        {
          organizationId: "org_1",
          userId: "user_owner",
          role: "owner",
          billingManagedByRole: "admin",
        },
        {
          organizationId: "org_1",
          userId: "user_member",
          role: "member",
          billingManagedByRole: "admin",
        },
      ],
    });
  });

  it("hides the Subscription list from a member who is not a Billing manager", async () => {
    signIn("user_member");

    expect(await statusOf(handler({}))).toBe(403);
  });

  it("shows it to an owner when the Billing manager role is admin", async () => {
    signIn("user_owner");

    await expect(handler({})).resolves.toMatchObject({ subscriptions: [ORG_SUBSCRIPTION] });
  });

  it("shows it to an App admin outside the Organization", async () => {
    signIn("user_operator", "sudo");

    await expect(handler({})).resolves.toMatchObject({ subscriptions: [ORG_SUBSCRIPTION] });
  });
});
