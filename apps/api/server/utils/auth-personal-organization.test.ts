import { memoryAdapter } from "better-auth/adapters/memory";
import { describe, expect, it, vi } from "vitest";
import {
  type AuthConfigDeps,
  createAuth,
  PERSONAL_ORGANIZATION_NAME_TEMPLATE,
  personalOrganizationName,
  shouldCreatePersonalOrganization,
} from "./auth-config";

/**
 * Personal organization: sign-up gives the user an Organization they own, and
 * every new session starts with their oldest Organization as the Active
 * organization. Runs the real better-auth config on the in-memory adapter.
 */

const PASSWORD = "correct-horse-battery-staple";

type MemoryDb = Record<string, Record<string, unknown>[]>;

function createMemoryDb(): MemoryDb {
  return {
    user: [],
    session: [],
    account: [],
    verification: [],
    twoFactor: [],
    organization: [],
    member: [],
    invitation: [],
    team: [],
    teamMember: [],
  };
}

function setup(overrides: Partial<AuthConfigDeps> = {}, db: MemoryDb = createMemoryDb()) {
  const sendEmail = vi.fn(async () => undefined);
  const auth = createAuth({
    database: memoryAdapter(db),
    appName: "beztack-test",
    appUrl: "https://app.example.test",
    corsOrigins: "",
    appAdminEmails: [],
    sendEmail,
    personalOrganizationOnSignup: true,
    ...overrides,
  });
  return { auth, db, sendEmail };
}

type TestAuth = ReturnType<typeof setup>["auth"];

function cookieHeaders(headers: Headers): Headers {
  const cookie = headers
    .getSetCookie()
    .map((entry) => entry.split(";")[0])
    .join("; ");
  return new Headers({ cookie });
}

/** Sign up and return headers carrying the sign-up session cookie. */
async function signUp(auth: TestAuth, email: string, name = "Visitor"): Promise<Headers> {
  const { headers } = await auth.api.signUpEmail({
    body: { email, password: PASSWORD, name },
    returnHeaders: true,
  });
  return cookieHeaders(headers);
}

async function signIn(auth: TestAuth, email: string): Promise<Headers> {
  const { headers } = await auth.api.signInEmail({
    body: { email, password: PASSWORD },
    returnHeaders: true,
  });
  return cookieHeaders(headers);
}

async function activeOrganizationIdOf(auth: TestAuth, headers: Headers) {
  const session = await auth.api.getSession({ headers });
  const record = session?.session as { activeOrganizationId?: string | null } | undefined;
  return record?.activeOrganizationId;
}

describe("Personal organization at sign-up", () => {
  it("makes the new user the owner of an organization and activates it", async () => {
    const { auth } = setup();

    const headers = await signUp(auth, "ana@example.test", "Ana");

    const organizations = await auth.api.listOrganizations({ headers });
    expect(organizations).toHaveLength(1);
    const activeId = await activeOrganizationIdOf(auth, headers);
    expect(activeId).toBe(organizations[0]?.id);
    const member = await auth.api.getActiveMember({ headers });
    expect(member?.role).toBe("owner");
  });

  it("derives the name from the user's name", async () => {
    const { auth } = setup();

    const headers = await signUp(auth, "ana@example.test", "Ana");

    const [organization] = await auth.api.listOrganizations({ headers });
    expect(organization?.name).toContain("Ana");
  });

  it("names it from the documented default template", async () => {
    const { auth } = setup();

    const headers = await signUp(auth, "ana@example.test", "Ana");

    const [organization] = await auth.api.listOrganizations({ headers });
    expect(organization?.name).toBe(personalOrganizationName("Ana"));
    expect(PERSONAL_ORGANIZATION_NAME_TEMPLATE).toContain("{name}");
  });

  it("gives two users with the same name different slugs", async () => {
    const { auth } = setup();

    const first = await signUp(auth, "ana1@example.test", "Ana");
    const second = await signUp(auth, "ana2@example.test", "Ana");

    const [firstOrganization] = await auth.api.listOrganizations({ headers: first });
    const [secondOrganization] = await auth.api.listOrganizations({ headers: second });
    expect(firstOrganization?.slug).toBeTruthy();
    expect(secondOrganization?.slug).toBeTruthy();
    expect(firstOrganization?.slug).not.toBe(secondOrganization?.slug);
  });

  it("creates no organization when the setting is off", async () => {
    const { auth } = setup({ personalOrganizationOnSignup: false });

    const headers = await signUp(auth, "ana@example.test", "Ana");

    expect(await auth.api.listOrganizations({ headers })).toHaveLength(0);
    expect(await activeOrganizationIdOf(auth, headers)).toBeFalsy();
  });

  it("still signs the user up when the organization cannot be created", async () => {
    const { auth, db } = setup();
    // Without its table the organization insert fails.
    delete (db as Partial<MemoryDb>).organization;
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const headers = await signUp(auth, "ana@example.test", "Ana");

    const session = await auth.api.getSession({ headers });
    expect(session?.user.email).toBe("ana@example.test");
    expect(logged).toHaveBeenCalled();
  });
});

describe("shouldCreatePersonalOrganization", () => {
  it.each([
    ["organization", true, true],
    ["organization", false, false],
    ["user", true, false],
    ["user", false, false],
  ] as const)("in %s mode with the flag %s -> %s", (subscriptionMode, onSignup, expected) => {
    expect(shouldCreatePersonalOrganization({ subscriptionMode, onSignup })).toBe(expected);
  });
});

describe("personalOrganizationName", () => {
  it("uses the user's name, or a fallback when it is blank", () => {
    expect(personalOrganizationName("  Ana ")).toBe("Ana's organization");
    expect(personalOrganizationName("   ")).toBe("Personal's organization");
  });
});

describe("Active organization on every new session", () => {
  it("picks the user's oldest organization at sign-in", async () => {
    const { auth } = setup();
    const signUpHeaders = await signUp(auth, "ana@example.test", "Ana");
    const [personal] = await auth.api.listOrganizations({ headers: signUpHeaders });
    const second = await auth.api.createOrganization({
      body: { name: "Second", slug: "second" },
      headers: signUpHeaders,
    });
    await auth.api.setActiveOrganization({
      body: { organizationId: second?.id },
      headers: signUpHeaders,
    });

    const headers = await signIn(auth, "ana@example.test");

    expect(await activeOrganizationIdOf(auth, headers)).toBe(personal?.id);
  });

  it("activates an existing organization for a user created before the feature", async () => {
    const off = setup({ personalOrganizationOnSignup: false });
    const signUpHeaders = await signUp(off.auth, "ana@example.test", "Ana");
    const created = await off.auth.api.createOrganization({
      body: { name: "Legacy", slug: "legacy" },
      headers: signUpHeaders,
    });
    await off.auth.api.setActiveOrganization({
      body: { organizationId: null },
      headers: signUpHeaders,
    });
    const { auth } = setup({ personalOrganizationOnSignup: true }, off.db);

    const headers = await signIn(auth, "ana@example.test");

    expect(await activeOrganizationIdOf(auth, headers)).toBe(created?.id);
  });

  it("leaves the session without an organization when the user has none", async () => {
    const { auth } = setup({ personalOrganizationOnSignup: false });
    await signUp(auth, "ana@example.test", "Ana");

    const headers = await signIn(auth, "ana@example.test");

    expect(await activeOrganizationIdOf(auth, headers)).toBeFalsy();
  });
});
