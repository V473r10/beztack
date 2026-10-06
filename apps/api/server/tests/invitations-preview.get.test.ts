import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rows: [] as unknown[],
  getRouterParam: vi.fn(),
}));

vi.mock("h3", () => ({
  createError(input: { statusCode?: number; statusMessage?: string }) {
    return Object.assign(new Error(input.statusMessage ?? "Error"), input);
  },
  defineEventHandler(handler: unknown) {
    return handler;
  },
  getRouterParam: mocks.getRouterParam,
}));

// A select chain that resolves to the rows the test sets up.
vi.mock("@beztack/db", () => {
  const chain = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    limit: async () => mocks.rows,
  };
  return {
    db: { select: () => chain },
    invitation: {},
    organization: {},
  };
});

const handler = (await import("@/server/routes/api/invitations/[id].get")).default as (
  event: unknown,
) => Promise<Record<string, unknown>>;

describe("GET /api/invitations/:id (public preview)", () => {
  beforeEach(() => {
    mocks.getRouterParam.mockReturnValue("inv_1");
    mocks.rows = [
      {
        id: "inv_1",
        role: "admin",
        status: "pending",
        expiresAt: new Date("2026-11-01T00:00:00.000Z"),
        organizationName: "Acme",
        organizationLogo: "https://cdn.example.test/acme.png",
        // Columns a careless select could leak: must never reach the response.
        email: "invitee@example.com",
        inviterEmail: "owner@example.com",
      },
    ];
  });

  it("returns only organization name and logo, role, status and expiry", async () => {
    const preview = await handler({});

    expect(preview).toEqual({
      id: "inv_1",
      role: "admin",
      status: "pending",
      expiresAt: "2026-11-01T00:00:00.000Z",
      organization: { name: "Acme", logo: "https://cdn.example.test/acme.png" },
    });
  });

  it("never contains an email address", async () => {
    const preview = await handler({});

    expect(JSON.stringify(preview)).not.toMatch(/@example\.com/);
    expect(JSON.stringify(preview)).not.toMatch(/email/i);
  });

  it("answers 404 for an unknown invitation", async () => {
    mocks.rows = [];

    await expect(handler({})).rejects.toMatchObject({ statusCode: 404 });
  });
});
