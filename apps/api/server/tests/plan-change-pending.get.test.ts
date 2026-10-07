import { beforeEach, describe, expect, it, vi } from "vitest";
import { createOrganizationAccessTestModule } from "@/server/domain/organization-access/testing";

const mocks = vi.hoisted(() => ({
  findPendingPlanChangeForMembershipTarget: vi.fn(),
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
vi.mock("@/server/utils/membership", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/server/utils/pending-plan-change-ledger", () => ({
  findPendingPlanChangeForMembershipTarget: mocks.findPendingPlanChangeForMembershipTarget,
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

const handler = (await import("@/server/routes/api/subscriptions/plan-change/pending.get"))
  .default as (event: unknown) => Promise<{ pendingPlanChange: unknown }>;

const EFFECTIVE_AT = new Date("2026-11-01T00:00:00.000Z");

function signIn(userId: string) {
  mocks.requireAuth.mockResolvedValue({
    user: { id: userId, email: `${userId}@example.com`, role: "user" },
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

describe("GET /api/subscriptions/plan-change/pending", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.env.SUBSCRIPTION_MODE = "organization";
    mocks.getQuery.mockReturnValue({});
    mocks.findPendingPlanChangeForMembershipTarget.mockResolvedValue({
      id: "ppc_1",
      direction: "downgrade",
      effectiveAt: EFFECTIVE_AT,
      subscriptionId: "sub_1",
      targetPlanSnapshot: {
        id: "plan_basic_month",
        canonicalTierId: "basic",
        billingCadence: "monthly",
        price: { amount: 2900, currency: "UYU" },
      },
    });
    mocks.access.current = createOrganizationAccessTestModule({
      memberships: [
        { organizationId: "org_1", userId: "user_owner", role: "owner" },
        { organizationId: "org_1", userId: "user_member", role: "member" },
      ],
    });
  });

  it("shows a Billing manager the Pending Plan change and when it applies", async () => {
    signIn("user_owner");

    await expect(handler({})).resolves.toEqual({
      pendingPlanChange: {
        id: "ppc_1",
        direction: "downgrade",
        effectiveAt: EFFECTIVE_AT.toISOString(),
        subscriptionId: "sub_1",
        targetPlan: {
          id: "plan_basic_month",
          tierId: "basic",
          billingCadence: "monthly",
          price: { amount: 2900, currency: "UYU" },
        },
      },
    });
    expect(mocks.findPendingPlanChangeForMembershipTarget).toHaveBeenCalledWith({
      type: "organization",
      id: "org_1",
    });
  });

  it("hides it from a member who is not a Billing manager", async () => {
    signIn("user_member");

    expect(await statusOf(handler({}))).toBe(403);
    expect(mocks.findPendingPlanChangeForMembershipTarget).not.toHaveBeenCalled();
  });

  it("answers null when nothing is pending", async () => {
    signIn("user_owner");
    mocks.findPendingPlanChangeForMembershipTarget.mockResolvedValue(null);

    await expect(handler({})).resolves.toEqual({ pendingPlanChange: null });
  });
});
