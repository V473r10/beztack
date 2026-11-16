/**
 * GET /api/health over HTTP, against a real Postgres. The route is mounted on
 * a real h3 app and called with a real `Request`, so the assertions read what
 * a monitor would see: status code, content type and JSON body.
 *
 * Runs when TEST_DATABASE_URL names a throwaway database whose name ends in
 * `_test`; skipped otherwise, except on CI, where it must run. The route only
 * runs `select 1`, so the schema is left alone.
 */
import { createApp, createRouter, toWebHandler } from "h3";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

if (process.env.CI && !TEST_DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL is required on CI for the health tests");
}

function assertThrowawayDatabase(url: string): void {
  const name = new URL(url).pathname.replace(/^\//, "");
  if (!name.endsWith("_test")) {
    throw new Error(`Refusing to use "${name}": TEST_DATABASE_URL must name a *_test database`);
  }
}

describe.skipIf(!TEST_DATABASE_URL)("GET /api/health on Postgres", () => {
  let dbModule: typeof import("@beztack/db");
  let request: (method: string, path?: string) => Promise<Response>;

  beforeAll(async () => {
    const url = TEST_DATABASE_URL as string;
    assertThrowawayDatabase(url);
    // @beztack/db opens its client from DATABASE_URL when first imported.
    process.env.DATABASE_URL = url;
    dbModule = await import("@beztack/db");
    const route = (await import("@/server/routes/api/health.get")).default;

    const router = createRouter().get("/api/health", route);
    const handle = toWebHandler(createApp().use(router));
    request = (method, path = "/api/health") =>
      handle(new Request(`http://localhost${path}`, { method }));
  });

  afterAll(async () => {
    await dbModule?.db.$client.end();
  });

  it("answers 200 with the overall status and the database when Postgres answers", async () => {
    const response = await request("GET");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({ status: "ok", database: "up" });
  });

  it("needs no credentials and carries no connection details", async () => {
    const response = await request("GET");
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).not.toContain(TEST_DATABASE_URL as string);
    expect(text).not.toContain(new URL(TEST_DATABASE_URL as string).hostname);
  });

  it("waits up to 5 seconds for a slow database, then answers 503", async () => {
    // A cold function or a sleeping managed Postgres can take a few seconds to answer.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const executeSpy = vi
      .spyOn(dbModule.db, "execute")
      .mockImplementation(() => new Promise(() => {}) as never);
    try {
      const pending = request("GET");

      // The database timeout is still armed one millisecond before 5 seconds.
      await vi.advanceTimersByTimeAsync(4999);
      expect(vi.getTimerCount()).toBe(1);

      await vi.advanceTimersByTimeAsync(1);
      const response = await pending;
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ status: "unavailable", database: "down" });
    } finally {
      executeSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  // This test ends the shared Postgres client, so it must stay the last one in this file.
  it("answers 503 with the same body shape once Postgres is unreachable", async () => {
    // Closing the client makes every later query fail, like a dropped connection.
    await dbModule.db.$client.end();

    const response = await request("GET");

    expect(response.status).toBe(503);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({ status: "unavailable", database: "down" });
  });
});
