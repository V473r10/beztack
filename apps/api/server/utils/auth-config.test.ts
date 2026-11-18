import { memoryAdapter } from "better-auth/adapters/memory";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type AuthConfigDeps, createAuth, shouldExposeAuthReference } from "./auth-config";

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

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response("ABCDE:0", {
          headers: { "content-type": "text/plain" },
        }),
    ),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("compromised passwords", () => {
  it("rejects a compromised password reset without consuming the reset token", async () => {
    const { auth, db } = setup();
    const { user } = await auth.api.signUpEmail({
      body: {
        email: "reset@example.test",
        name: "Visitor",
        password: PASSWORD,
      },
    });
    // Arrange a valid reset link at the database boundary; email delivery is outside this test.
    db.verification.push({
      id: "reset-verification",
      identifier: "reset-password:reset-token",
      value: user.id,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("1E4C9B93F3F0682250B6CF8331B7EE68FD8:42")),
    );
    await expect(
      auth.api.resetPassword({
        body: {
          token: "reset-token",
          newPassword: "password",
        },
      }),
    ).rejects.toMatchObject({ body: { code: "PASSWORD_COMPROMISED" } });
    await expect(
      auth.api.resetPassword({
        body: {
          token: "reset-token",
          newPassword: PASSWORD,
        },
      }),
    ).resolves.toEqual({ status: true });
  });

  it("rejects a compromised password change and keeps the previous password usable", async () => {
    const { auth } = setup();
    await signUp(auth, "change@example.test");
    const headers = await signIn(auth, "change@example.test");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("1E4C9B93F3F0682250B6CF8331B7EE68FD8:42")),
    );

    await expect(
      auth.api.changePassword({
        headers,
        body: {
          currentPassword: PASSWORD,
          newPassword: "password",
        },
      }),
    ).rejects.toMatchObject({ body: { code: "PASSWORD_COMPROMISED" } });
    await expect(signIn(auth, "change@example.test")).resolves.toBeInstanceOf(Headers);
  });

  it("rejects a leaked password using only the SHA-1 prefix", async () => {
    // SHA-1 of password: 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8.
    const fetchMock = vi.fn(
      async () =>
        new Response(
          "1E4C9B93F3F0682250B6CF8331B7EE68FD8:42\r\n00000000000000000000000000000000000:0",
          { headers: { "content-type": "text/plain" } },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { auth } = setup();

    await expect(
      auth.api.signUpEmail({
        body: {
          email: "leaked@example.test",
          name: "Visitor",
          password: "password",
        },
      }),
    ).rejects.toMatchObject({ body: { code: "PASSWORD_COMPROMISED" } });
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toBe(
      "https://api.pwnedpasswords.com/range/5BAA6",
    );
  });
});

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

describe("auth reference environment rule", () => {
  it.each([
    ["production", false],
    ["development", true],
    ["test", true],
    ["staging", true],
    ["", true],
    [undefined, true],
  ])("exposes the reference for NODE_ENV=%s: %s", (nodeEnv, expected) => {
    expect(shouldExposeAuthReference(nodeEnv)).toBe(expected);
  });
});

describe("auth OpenAPI routes", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ["development", 200],
    ["test", 200],
    ["production", 404],
  ])("serves OpenAPI only outside production (%s)", async (nodeEnv, status) => {
    vi.stubEnv("NODE_ENV", nodeEnv);
    const { auth } = setup();

    if (status === 200) {
      expect(auth.api).toHaveProperty("generateOpenAPISchema");
      expect(auth.api).toHaveProperty("openAPIReference");
    } else {
      expect(auth.api).not.toHaveProperty("generateOpenAPISchema");
      expect(auth.api).not.toHaveProperty("openAPIReference");
    }

    for (const path of ["/reference", "/open-api/generate-schema"]) {
      const response = await auth.handler(new Request(`https://app.example.test/api/auth${path}`));
      expect(response.status).toBe(status);
      if (status === 200 && path === "/reference") {
        expect(response.headers.get("content-type")).toContain("text/html");
        expect(await response.text()).toContain("api-reference");
      }
      if (status === 200 && path === "/open-api/generate-schema") {
        expect(await response.json()).toHaveProperty("paths./sign-in/email");
      }
    }
  });
});

/** One browser: retain untouched cookies and apply replacements/deletions. */
function browser(auth: TestAuth) {
  const cookies = new Map<string, string>();
  return async (path: string, body?: Record<string, unknown>) => {
    const response = await auth.handler(
      new Request(`http://localhost:3000/api/auth${path}`, {
        method: body ? "POST" : "GET",
        headers: {
          cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join("; "),
          ...(body ? { "content-type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    );
    for (const entry of response.headers.getSetCookie()) {
      const pair = entry.split(";")[0];
      const separator = pair.indexOf("=");
      const name = pair.slice(0, separator);
      const value = pair.slice(separator + 1);
      if (/;\s*max-age=0(?:;|$)/i.test(entry) || !value) {
        cookies.delete(name);
      } else {
        cookies.set(name, value);
      }
    }
    expect(response.status).toBe(200);
    return response.json();
  };
}

describe("multiple sessions in one browser", () => {
  it("lists two logins, switches the active account and revokes only the other session", async () => {
    const { auth } = setup();
    await signUp(auth, "first@example.test");
    await signUp(auth, "second@example.test");
    const request = browser(auth);

    await request("/sign-in/email", { email: "first@example.test", password: PASSWORD });
    await request("/sign-in/email", { email: "second@example.test", password: PASSWORD });
    const sessions = await request("/multi-session/list-device-sessions");
    expect(sessions).toHaveLength(2);
    expect(sessions.map((item: { user: { email: string } }) => item.user.email).sort()).toEqual([
      "first@example.test",
      "second@example.test",
    ]);
    expect((await request("/get-session")).user.email).toBe("second@example.test");

    const first = sessions.find(
      (item: { user: { email: string } }) => item.user.email === "first@example.test",
    );
    const second = sessions.find(
      (item: { user: { email: string } }) => item.user.email === "second@example.test",
    );
    await request("/multi-session/set-active", { sessionToken: first.session.token });
    expect((await request("/get-session")).user.email).toBe("first@example.test");

    await request("/multi-session/revoke", { sessionToken: second.session.token });
    const remaining = await request("/multi-session/list-device-sessions");
    expect(remaining).toHaveLength(1);
    expect(remaining[0].session.token).toBe(first.session.token);
    expect((await request("/get-session")).user.email).toBe("first@example.test");
  });
});

describe("device session limits and sign-out", () => {
  it("remembers at most five accounts in the browser", async () => {
    const { auth } = setup();
    const request = browser(auth);
    for (let index = 1; index <= 6; index += 1) {
      const email = `account${index}@example.test`;
      await signUp(auth, email);
      await request("/sign-in/email", { email, password: PASSWORD });
    }
    const sessions = await request("/multi-session/list-device-sessions");
    expect(sessions).toHaveLength(5);
    expect(sessions.map((item: { user: { email: string } }) => item.user.email).sort()).toEqual([
      "account1@example.test",
      "account2@example.test",
      "account3@example.test",
      "account4@example.test",
      "account5@example.test",
    ]);
  });

  it("signs out and removes all remembered device sessions", async () => {
    const { auth } = setup();
    const request = browser(auth);
    for (const email of ["first@example.test", "second@example.test"]) {
      await signUp(auth, email);
      await request("/sign-in/email", { email, password: PASSWORD });
    }
    expect(await request("/multi-session/list-device-sessions")).toHaveLength(2);

    await request("/sign-out", {});

    expect(await request("/get-session")).toBeNull();
    expect(await request("/multi-session/list-device-sessions")).toEqual([]);
  });
});
