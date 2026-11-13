import { createPolarAuthPlugin } from "@beztack/payments-polar/auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAuth } from "./auth-config";

/**
 * Sign-up with the real Polar plugin (`createPolarAuthPlugin`, wired like
 * `auth.ts`) while the Polar HTTP API is faked at `fetch`. The customer is
 * created best effort: whatever Polar answers, the visitor ends up with a
 * usable account.
 */

const PASSWORD = "correct-horse-battery-staple";
const EMAIL = "visitor@example.test";

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

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const EMPTY_PAGE = {
  items: [],
  pagination: { total_count: 0, max_page: 1 },
};

const REJECTED_EMAIL = {
  detail: [
    {
      type: "value_error",
      loc: ["body", "email"],
      msg: `value is not a valid email address: The domain name ${EMAIL.split("@")[1]} is not valid.`,
      input: EMAIL,
    },
  ],
};

function setup() {
  const db = createMemoryDb();
  const auth = createAuth({
    database: memoryAdapter(db),
    appName: "beztack-test",
    appUrl: "https://app.example.test",
    corsOrigins: "",
    appAdminEmails: [],
    sendEmail: vi.fn(async () => undefined),
    plugins: [
      createPolarAuthPlugin({
        accessToken: "polar_test_token",
        server: "sandbox",
        products: [],
        successUrl: "https://app.example.test/checkout/success",
        createCustomerOnSignUp: true,
      }),
    ],
  });
  return { auth, db };
}

function signUpRequest(email: string): Request {
  return new Request("https://app.example.test/api/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://app.example.test" },
    body: JSON.stringify({ email, password: PASSWORD, name: "Visitor" }),
  });
}

describe("sign-up with the Polar plugin", () => {
  const logged: string[] = [];

  beforeEach(() => {
    logged.length = 0;
    for (const method of ["log", "info", "warn", "error"] as const) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        logged.push(
          args.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" "),
        );
      });
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("succeeds when Polar rejects the email (422) and leaves a usable account", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: Request | URL | string, init?: RequestInit) => {
        const method = input instanceof Request ? input.method : (init?.method ?? "GET");
        return method === "POST"
          ? jsonResponse(422, REJECTED_EMAIL)
          : jsonResponse(200, EMPTY_PAGE);
      }),
    );
    const { auth } = setup();

    const response = await auth.handler(signUpRequest(EMAIL));

    expect(response.status).toBe(200);
    const signedIn = await auth.api.signInEmail({ body: { email: EMAIL, password: PASSWORD } });
    expect(signedIn.user.email).toBe(EMAIL);
  });

  it("succeeds when Polar is down", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    const { auth } = setup();

    const response = await auth.handler(signUpRequest(EMAIL));

    expect(response.status).toBe(200);
    const signedIn = await auth.api.signInEmail({ body: { email: EMAIL, password: PASSWORD } });
    expect(signedIn.user.email).toBe(EMAIL);
  });

  it("treats an existing customer linked to another user as success (CONFLICT)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(200, {
          items: [
            {
              id: "5b0d9a2e-6a56-4b43-8d2e-0e4a0d1e7c11",
              type: "individual",
              email: EMAIL,
              external_id: "user_from_before_the_reset",
            },
          ],
          pagination: { total_count: 1, max_page: 1 },
        }),
      ),
    );
    const { auth } = setup();

    const response = await auth.handler(signUpRequest(EMAIL));

    expect(response.status).toBe(200);
    const signedIn = await auth.api.signInEmail({ body: { email: EMAIL, password: PASSWORD } });
    expect(signedIn.user.email).toBe(EMAIL);
  });

  it("logs the failure without the email in clear", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: Request | URL | string, init?: RequestInit) => {
        const method = input instanceof Request ? input.method : (init?.method ?? "GET");
        return method === "POST"
          ? jsonResponse(422, REJECTED_EMAIL)
          : jsonResponse(200, EMPTY_PAGE);
      }),
    );
    const { auth } = setup();

    await auth.handler(signUpRequest(EMAIL));

    const output = logged.join("\n");
    expect(output).toMatch(/customer/i);
    expect(output).not.toContain(EMAIL);
  });
});
