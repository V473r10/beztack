import { beforeEach, describe, expect, it, vi } from "vitest";
import { createOrganizationAccessTestModule } from "@/server/domain/organization-access/testing";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock("h3", () => ({
  createError(input: { statusCode?: number; statusMessage?: string }) {
    return Object.assign(new Error(input.statusMessage ?? "Error"), input);
  },
  eventHandler(handler: unknown) {
    return handler;
  },
}));
vi.mock("@/server/utils/auth", () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock("@/server/domain/organization-access", async () => ({
  ...(await vi.importActual<typeof import("@/server/domain/organization-access/contract")>(
    "@/server/domain/organization-access/contract",
  )),
  organizationAccess: createOrganizationAccessTestModule({ appAdminEmails: "root@example.com" }),
}));

async function loadHandler() {
  return (await import("../routes/api/auth/admin/metrics")).default as (
    event: unknown,
  ) => Promise<{ metrics: Array<{ label: string }>; systemInfo: unknown }>;
}

const event = { headers: new Headers(), context: {} };

describe("GET /api/auth/admin/metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a request without a session with 401", async () => {
    mocks.getSession.mockResolvedValue(null);
    const handler = await loadHandler();

    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("rejects a signed-in user who is not an App admin with 403", async () => {
    mocks.getSession.mockResolvedValue({
      user: { id: "user_1", email: "customer@example.com", role: "user" },
      session: {},
    });
    const handler = await loadHandler();

    await expect(handler(event)).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects a sudo user whose email is not on the App admin allowlist with 403", async () => {
    mocks.getSession.mockResolvedValue({
      user: { id: "user_2", email: "other@example.com", role: "sudo" },
      session: {},
    });
    const handler = await loadHandler();

    await expect(handler(event)).rejects.toMatchObject({ statusCode: 403 });
  });

  it("returns only measured system metrics to an App admin", async () => {
    mocks.getSession.mockResolvedValue({
      user: { id: "admin_1", email: "root@example.com", role: "sudo" },
      session: {},
    });
    const handler = await loadHandler();

    const body = await handler(event);

    expect(body.metrics.map((metric) => metric.label)).toEqual(["Memory Usage", "CPU Load"]);
    expect(body.systemInfo).toBeTruthy();
  });
});
