import type { Subscription } from "@beztack/payments";
import { describe, expect, it } from "vitest";
import { OrganizationAccessError } from "./contract";
import { createOrganizationAccess, isAppAdminActor, parseAppAdminEmails } from "./implementation";
import { createOrganizationAccessTestModule } from "./testing";

const OPERATOR = { id: "user_operator", email: "Operator@Example.com", role: "sudo" };
const OWNER = { id: "user_owner", email: "owner@example.com", role: "user" };
const ADMIN = { id: "user_admin", email: "admin@example.com", role: "user" };
const MEMBER = { id: "user_member", email: "member@example.com", role: "user" };
const STRANGER = { id: "user_stranger", email: "stranger@example.com", role: "user" };

function world() {
  return createOrganizationAccessTestModule({
    appAdminEmails: "operator@example.com",
    memberships: [
      { organizationId: "org_1", userId: OWNER.id, role: "owner" },
      { organizationId: "org_1", userId: ADMIN.id, role: "admin" },
      { organizationId: "org_1", userId: MEMBER.id, role: "member" },
      {
        organizationId: "org_2",
        userId: ADMIN.id,
        role: "admin",
        billingManagedByRole: "admin",
      },
    ],
  });
}

async function refusal(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("expected the guard to refuse");
}

function subscription(metadata: Record<string, unknown>, extra: Partial<Subscription> = {}) {
  return {
    id: "sub_1",
    status: "active",
    productId: "plan_1",
    customerId: "provider-customer",
    metadata,
    ...extra,
  } as Subscription;
}

describe("App admin", () => {
  it("needs both the sudo App role and an allowlisted email", () => {
    const access = world();

    expect(access.isAppAdmin(OPERATOR)).toBe(true);
    expect(access.isAppAdmin({ ...OPERATOR, role: "user" })).toBe(false);
    expect(access.isAppAdmin({ ...OPERATOR, email: "someone@example.com" })).toBe(false);
  });

  it("reads roles exactly, never by substring", () => {
    const emails = ["operator@example.com"];

    expect(isAppAdminActor({ email: OPERATOR.email, role: ["user", "sudo"] }, emails)).toBe(true);
    expect(isAppAdminActor({ email: OPERATOR.email, role: "pseudo" }, emails)).toBe(false);
    expect(isAppAdminActor({ email: OPERATOR.email, role: "user,revoked-sudo" }, emails)).toBe(
      false,
    );
    expect(isAppAdminActor({ email: OPERATOR.email, role: null }, emails)).toBe(false);
  });

  it("parses the allowlist trimmed, lowercased and without empty entries", () => {
    expect(parseAppAdminEmails(" A@Example.com , ,b@example.com,")).toEqual([
      "a@example.com",
      "b@example.com",
    ]);
  });

  it("has no implicit Organization role", async () => {
    const access = world();

    const asMember = await refusal(access.requireMember(OPERATOR, "org_1"));
    const asAdmin = await refusal(access.requireOrganizationAdmin(OPERATOR, "org_1"));

    expect(asMember).toBeInstanceOf(OrganizationAccessError);
    expect(asMember).toMatchObject({ statusCode: 403, code: "not-a-member" });
    expect(asAdmin).toMatchObject({ statusCode: 403, code: "not-a-member" });
    expect(await access.isBillingManager({ userId: OPERATOR.id, organizationId: "org_1" })).toBe(
      false,
    );
  });
});

describe("Organization guards", () => {
  it("requireMember admits every member and refuses outsiders", async () => {
    const access = world();

    await expect(access.requireMember(MEMBER, "org_1")).resolves.toMatchObject({ role: "member" });
    await expect(access.requireMember(OWNER, "org_1")).resolves.toMatchObject({ role: "owner" });
    expect(await refusal(access.requireMember(STRANGER, "org_1"))).toMatchObject({
      code: "not-a-member",
    });
    expect(await refusal(access.requireMember(MEMBER, "org_2"))).toMatchObject({
      code: "not-a-member",
    });
  });

  it("requireOrganizationAdmin ranks member < admin < owner", async () => {
    const access = world();

    await expect(access.requireOrganizationAdmin(OWNER, "org_1")).resolves.toMatchObject({
      role: "owner",
    });
    await expect(access.requireOrganizationAdmin(ADMIN, "org_1")).resolves.toMatchObject({
      role: "admin",
    });
    expect(await refusal(access.requireOrganizationAdmin(MEMBER, "org_1"))).toMatchObject({
      statusCode: 403,
      code: "not-an-organization-admin",
    });
  });

  it("fails closed with no dependencies", async () => {
    const access = createOrganizationAccess();

    expect(access.isAppAdmin(OPERATOR)).toBe(false);
    expect(await refusal(access.requireMember(OWNER, "org_1"))).toMatchObject({
      code: "not-a-member",
    });
  });
});

describe("Billing manager membership", () => {
  it("defaults the billing role to owner", async () => {
    const access = world();

    expect(await access.isBillingManager({ userId: OWNER.id, organizationId: "org_1" })).toBe(true);
    expect(await access.isBillingManager({ userId: ADMIN.id, organizationId: "org_1" })).toBe(
      false,
    );
  });

  it("follows the Organization's configured billing role", async () => {
    const access = world();

    expect(await access.isBillingManager({ userId: ADMIN.id, organizationId: "org_2" })).toBe(true);
  });

  it("admits a higher role than the configured one (owner when the role is admin)", async () => {
    const access = createOrganizationAccessTestModule({
      memberships: [
        { organizationId: "org_1", userId: OWNER.id, role: "owner", billingManagedByRole: "admin" },
        { organizationId: "org_1", userId: ADMIN.id, role: "admin", billingManagedByRole: "admin" },
        {
          organizationId: "org_1",
          userId: MEMBER.id,
          role: "member",
          billingManagedByRole: "admin",
        },
      ],
    });

    expect(await access.isBillingManager({ userId: OWNER.id, organizationId: "org_1" })).toBe(true);
    expect(await access.isBillingManager({ userId: ADMIN.id, organizationId: "org_1" })).toBe(true);
    expect(await access.isBillingManager({ userId: MEMBER.id, organizationId: "org_1" })).toBe(
      false,
    );
  });

  it("matches an unknown configured role exactly instead of ranking it", async () => {
    const access = createOrganizationAccessTestModule({
      memberships: [
        {
          organizationId: "org_1",
          userId: OWNER.id,
          role: "owner",
          billingManagedByRole: "finance",
        },
        {
          organizationId: "org_1",
          userId: MEMBER.id,
          role: "member,finance",
          billingManagedByRole: "finance",
        },
      ],
    });

    expect(await access.isBillingManager({ userId: OWNER.id, organizationId: "org_1" })).toBe(
      false,
    );
    expect(await access.isBillingManager({ userId: MEMBER.id, organizationId: "org_1" })).toBe(
      true,
    );
  });
});

describe("Billing manager gate (canManageBilling)", () => {
  it("admits Billing managers and App admins, nobody else", async () => {
    const access = world();

    expect(await access.canManageBilling(OWNER, "org_1")).toBe(true);
    expect(await access.canManageBilling(OPERATOR, "org_1")).toBe(true);
    expect(await access.canManageBilling(OPERATOR, null)).toBe(true);
    expect(await access.canManageBilling(MEMBER, "org_1")).toBe(false);
    expect(await access.canManageBilling(ADMIN, "org_1")).toBe(false);
    expect(await access.canManageBilling(STRANGER, "org_1")).toBe(false);
    expect(await access.canManageBilling(OWNER, null)).toBe(false);
  });
});

describe("Subscription ownership", () => {
  it("lets an App admin manage any Subscription (billing exception)", () => {
    const access = world();

    expect(
      access.ownsSubscription(
        { ...OPERATOR, activeOrganizationId: null },
        subscription({ referenceId: "org_9" }),
        "organization",
      ),
    ).toBe(true);
  });

  it("does not treat sudo without the allowlist as an owner", () => {
    const access = world();

    expect(
      access.ownsSubscription(
        { ...OPERATOR, email: "someone@example.com", activeOrganizationId: "org_1" },
        subscription({ referenceId: "org_9" }),
        "organization",
      ),
    ).toBe(false);
  });

  it("matches the active organization in organization mode", () => {
    const access = world();
    const actor = { ...MEMBER, activeOrganizationId: "org_1" };

    expect(
      access.ownsSubscription(actor, subscription({ referenceId: "org_1" }), "organization"),
    ).toBe(true);
    expect(
      access.ownsSubscription(actor, subscription({ organizationId: "org_1" }), "organization"),
    ).toBe(true);
    expect(
      access.ownsSubscription(actor, subscription({ referenceId: "org_2" }), "organization"),
    ).toBe(false);
    expect(
      access.ownsSubscription(
        { ...MEMBER, activeOrganizationId: null },
        subscription({ referenceId: "org_1" }),
        "organization",
      ),
    ).toBe(false);
  });

  it("matches the user by id or email in user mode", () => {
    const access = world();
    const actor = { ...MEMBER, activeOrganizationId: null };

    expect(
      access.ownsSubscription(actor, subscription({}, { customerId: MEMBER.id }), "user"),
    ).toBe(true);
    expect(
      access.ownsSubscription(
        actor,
        subscription({}, { customerEmail: " Member@Example.com " }),
        "user",
      ),
    ).toBe(true);
    expect(access.ownsSubscription(actor, subscription({ userId: MEMBER.id }), "user")).toBe(true);
    expect(
      access.ownsSubscription(actor, subscription({ ownerEmail: "member@example.com" }), "user"),
    ).toBe(true);
    expect(access.ownsSubscription(actor, subscription({ userId: OWNER.id }), "user")).toBe(false);
  });
});
