import { memoryAdapter } from "better-auth/adapters/memory";
import { describe, expect, it, vi } from "vitest";
import { type AuthConfigDeps, createAuth } from "./auth-config";

/**
 * Runs the real better-auth config (`createAuth`, the same factory `auth.ts`
 * uses) on better-auth's in-memory adapter. Only the database and the email
 * sender are swapped, so a misplaced hook or a missing admin role fails here.
 */

const PASSWORD = "correct-horse-battery-staple";
const OPERATOR_EMAIL = "operator@example.test";

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

function setup(overrides: Partial<AuthConfigDeps> & { db?: MemoryDb } = {}) {
  const db = overrides.db ?? createMemoryDb();
  const sendEmail = vi.fn(async () => undefined);
  const auth = createAuth({
    database: memoryAdapter(db),
    appName: "beztack-test",
    appUrl: "https://app.example.test",
    corsOrigins: "https://admin.example.test",
    appAdminEmails: [OPERATOR_EMAIL],
    sendEmail,
    ...overrides,
  });
  return { auth, db, sendEmail };
}

type TestAuth = ReturnType<typeof setup>["auth"];

async function signUp(auth: TestAuth, email: string) {
  await auth.api.signUpEmail({ body: { email, password: PASSWORD, name: email.split("@")[0] } });
}

/** Sign in and return request headers carrying the session cookie. */
async function signIn(auth: TestAuth, email: string): Promise<Headers> {
  const { headers } = await auth.api.signInEmail({
    body: { email, password: PASSWORD },
    returnHeaders: true,
  });
  const cookie = headers
    .getSetCookie()
    .map((entry) => entry.split(";")[0])
    .join("; ");
  return new Headers({ cookie });
}

async function findRole(auth: TestAuth, email: string): Promise<unknown> {
  const context = await auth.$context;
  const found = await context.internalAdapter.findUserByEmail(email);
  return (found?.user as { role?: unknown } | undefined)?.role;
}

async function setRole(auth: TestAuth, email: string, role: string): Promise<void> {
  const context = await auth.$context;
  const found = await context.internalAdapter.findUserByEmail(email);
  if (!found) {
    throw new Error(`no user ${email}`);
  }
  await context.internalAdapter.updateUser(found.user.id, { role });
}

async function statusOf(promise: Promise<unknown>): Promise<number> {
  try {
    await promise;
    return 200;
  } catch (error) {
    return (error as { statusCode?: number }).statusCode ?? 500;
  }
}

describe("better-auth config", () => {
  it("sends the welcome email after sign-up (the hook runs)", async () => {
    const { auth, sendEmail } = setup();

    await signUp(auth, "new@example.test");

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ type: "welcome", to: "new@example.test" }),
    );
  });

  it("promotes an allowlisted operator to sudo on sign-up", async () => {
    const { auth } = setup();

    await signUp(auth, OPERATOR_EMAIL);

    expect(await findRole(auth, OPERATOR_EMAIL)).toBe("sudo");
  });

  it("promotes an existing user on sign-in once their email is allowlisted", async () => {
    const db = createMemoryDb();
    const before = setup({ db, appAdminEmails: [] });
    await signUp(before.auth, OPERATOR_EMAIL);
    expect(await findRole(before.auth, OPERATOR_EMAIL)).not.toBe("sudo");

    const after = setup({ db });
    await signIn(after.auth, OPERATOR_EMAIL);

    expect(await findRole(after.auth, OPERATOR_EMAIL)).toBe("sudo");
  });

  it("does not promote a user whose email is not allowlisted", async () => {
    const { auth } = setup();

    await signUp(auth, "someone@example.test");
    await signIn(auth, "someone@example.test");

    expect(await findRole(auth, "someone@example.test")).toBe("user");
  });

  it("lets an App admin (sudo + allowlisted) call better-auth admin endpoints", async () => {
    const { auth } = setup();
    await signUp(auth, OPERATOR_EMAIL);
    const headers = await signIn(auth, OPERATOR_EMAIL);

    expect(await statusOf(auth.api.listUsers({ query: {}, headers }))).toBe(200);
  });

  it("rejects sudo without an allowlisted email on admin endpoints", async () => {
    const { auth } = setup();
    await signUp(auth, "impostor@example.test");
    await setRole(auth, "impostor@example.test", "sudo");
    const headers = await signIn(auth, "impostor@example.test");

    expect(await statusOf(auth.api.listUsers({ query: {}, headers }))).toBe(403);
  });

  it("rejects a regular user on admin endpoints", async () => {
    const { auth } = setup();
    await signUp(auth, "someone@example.test");
    const headers = await signIn(auth, "someone@example.test");

    expect(await statusOf(auth.api.listUsers({ query: {}, headers }))).toBe(403);
  });

  it("builds invitation links from APP_URL", async () => {
    const { auth, sendEmail } = setup({ appUrl: "https://app.example.test/" });
    await signUp(auth, "owner@example.test");
    const headers = await signIn(auth, "owner@example.test");
    const organization = await auth.api.createOrganization({
      body: { name: "Acme", slug: "acme" },
      headers,
    });

    await auth.api.createInvitation({
      body: { email: "guest@example.test", role: "member", organizationId: organization?.id },
      headers,
    });

    const invitation = sendEmail.mock.calls
      .map(([props]) => props as { type: string; data: { invitationUrl?: string } })
      .find((props) => props.type === "organization-invitation");
    expect(invitation?.data.invitationUrl).toMatch(
      /^https:\/\/app\.example\.test\/accept-invitation\/[^/]+$/,
    );
  });

  it("trusts CORS_ORIGINS plus the origin of APP_URL", async () => {
    const { auth } = setup();

    const { trustedOrigins } = await auth.$context;

    expect(trustedOrigins).toEqual(
      expect.arrayContaining(["https://app.example.test", "https://admin.example.test"]),
    );
  });

  it.each([
    ["https://app.example.test", true],
    ["http://localhost:5173", false],
  ])("marks the session cookie secure from the APP_URL protocol (%s)", async (appUrl, secure) => {
    const { auth } = setup({ appUrl });
    await signUp(auth, "someone@example.test");

    const { headers } = await auth.api.signInEmail({
      body: { email: "someone@example.test", password: PASSWORD },
      returnHeaders: true,
    });
    const sessionCookie = headers.getSetCookie().find((entry) => entry.includes("session_token"));

    expect(sessionCookie).toBeDefined();
    expect(/;\s*Secure/i.test(sessionCookie ?? "")).toBe(secure);
  });
});
