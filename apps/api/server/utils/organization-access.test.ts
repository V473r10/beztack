import { describe, expect, it, vi } from "vitest";
import { createOrganizationAccessTestModule } from "@/server/domain/organization-access/testing";

const mocks = vi.hoisted(() => ({ requireAuth: vi.fn() }));

vi.mock("@/server/utils/membership", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/server/domain/organization-access", async () => ({
  ...(await vi.importActual<typeof import("@/server/domain/organization-access/contract")>(
    "@/server/domain/organization-access/contract",
  )),
  organizationAccess: {},
}));
vi.mock("h3", () => ({
  createError(input: { statusCode: number; statusMessage: string }) {
    return Object.assign(new Error(input.statusMessage), input);
  },
}));

const {
  requireActiveOrganization,
  requireOrgAdmin,
  requireOrganizationBillingManagerAccess,
  requireOrganizationMember,
} = await import("./organization-access");

const access = createOrganizationAccessTestModule({
  appAdminEmails: "operator@example.com",
  memberships: [
    { organizationId: "org_1", userId: "user_owner", role: "owner" },
    { organizationId: "org_1", userId: "user_member", role: "member" },
  ],
});

const event = {} as Parameters<typeof requireOrgAdmin>[0];

function signIn(userId: string, options: { activeOrganizationId?: string | null; role?: string }) {
  mocks.requireAuth.mockResolvedValue({
    user: { id: userId, email: `${userId}@example.com`, role: options.role ?? "user" },
    session: { activeOrganizationId: options.activeOrganizationId ?? null },
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

describe("Organization guards", () => {
  it("requireActiveOrganization needs an Active organization the caller belongs to", async () => {
    signIn("user_member", { activeOrganizationId: "org_1" });
    await expect(requireActiveOrganization(event, access)).resolves.toMatchObject({
      organizationId: "org_1",
      membership: { role: "member" },
    });

    signIn("user_member", { activeOrganizationId: null });
    expect(await statusOf(requireActiveOrganization(event, access))).toBe(400);

    signIn("user_stranger", { activeOrganizationId: "org_1" });
    expect(await statusOf(requireActiveOrganization(event, access))).toBe(403);
  });

  it("requireOrgAdmin refuses a plain member and admits the owner", async () => {
    signIn("user_member", { activeOrganizationId: "org_1" });
    expect(await statusOf(requireOrgAdmin(event, access))).toBe(403);

    signIn("user_owner", { activeOrganizationId: "org_1" });
    expect(await statusOf(requireOrgAdmin(event, access))).toBe(200);
  });

  it("an App admin outside the Organization is refused (no implicit Organization role)", async () => {
    mocks.requireAuth.mockResolvedValue({
      user: { id: "user_operator", email: "operator@example.com", role: "sudo" },
      session: { activeOrganizationId: "org_1" },
    });

    expect(await statusOf(requireOrgAdmin(event, access))).toBe(403);
    expect(await statusOf(requireOrganizationMember(event, "org_1", access))).toBe(403);
  });

  it("passes a signed-out 401 through untouched", async () => {
    mocks.requireAuth.mockRejectedValue(
      Object.assign(new Error("Unauthorized"), { statusCode: 401 }),
    );

    expect(await statusOf(requireOrganizationMember(event, "org_1", access))).toBe(401);
  });
});

describe("requireOrganizationBillingManagerAccess", () => {
  const billingAccess = createOrganizationAccessTestModule({
    appAdminEmails: "operator@example.com",
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
  const auth = (id: string, role = "user") =>
    ({ user: { id, email: `${id}@example.com`, role }, session: {} }) as never;

  it("admits an owner when the billing role is admin, refuses a plain member", async () => {
    expect(
      await statusOf(
        requireOrganizationBillingManagerAccess(auth("user_owner"), "org_1", billingAccess),
      ),
    ).toBe(200);
    expect(
      await statusOf(
        requireOrganizationBillingManagerAccess(auth("user_member"), "org_1", billingAccess),
      ),
    ).toBe(403);
  });

  it("admits an App admin even without an Organization; refuses others without one", async () => {
    const operator = {
      user: { id: "user_operator", email: "operator@example.com", role: "sudo" },
      session: {},
    } as never;
    expect(
      await statusOf(requireOrganizationBillingManagerAccess(operator, null, billingAccess)),
    ).toBe(200);
    expect(
      await statusOf(
        requireOrganizationBillingManagerAccess(auth("user_owner"), null, billingAccess),
      ),
    ).toBe(403);
  });
});
