import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { H3Event } from "h3";
import { afterEach, describe, expect, it, vi } from "vitest";
import { requireCronSecret } from "./cron-secret";

const SECRET = "a".repeat(32);

function cronEvent(headers: Record<string, string> = {}): H3Event {
  const req = new IncomingMessage(new Socket());
  req.method = "POST";
  req.url = "/api/cron/job";
  req.headers = headers;
  return new H3Event(req, new ServerResponse(req));
}

function statusOf(run: () => void): number | undefined {
  try {
    run();
  } catch (error) {
    return (error as { statusCode?: number }).statusCode;
  }
  return undefined;
}

describe("requireCronSecret", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects a request without the secret", () => {
    vi.stubEnv("EXAMPLE_CRON_SECRET", SECRET);

    expect(statusOf(() => requireCronSecret(cronEvent(), "EXAMPLE_CRON_SECRET"))).toBe(401);
  });

  it("rejects a request with the wrong secret", () => {
    vi.stubEnv("EXAMPLE_CRON_SECRET", SECRET);
    const event = cronEvent({ "x-cron-secret": "b".repeat(32) });

    expect(statusOf(() => requireCronSecret(event, "EXAMPLE_CRON_SECRET"))).toBe(401);
  });

  it("rejects another job's secret", () => {
    vi.stubEnv("EXAMPLE_CRON_SECRET", SECRET);
    vi.stubEnv("OTHER_CRON_SECRET", "c".repeat(32));
    const event = cronEvent({ "x-cron-secret": "c".repeat(32) });

    expect(statusOf(() => requireCronSecret(event, "EXAMPLE_CRON_SECRET"))).toBe(401);
  });

  it("disables the job with 503 when its secret is not configured", () => {
    vi.stubEnv("EXAMPLE_CRON_SECRET", "");
    const event = cronEvent({ "x-cron-secret": "" });

    expect(statusOf(() => requireCronSecret(event, "EXAMPLE_CRON_SECRET"))).toBe(503);
  });

  it("accepts the secret in the x-cron-secret header", () => {
    vi.stubEnv("EXAMPLE_CRON_SECRET", SECRET);
    const event = cronEvent({ "x-cron-secret": SECRET });

    expect(() => requireCronSecret(event, "EXAMPLE_CRON_SECRET")).not.toThrow();
  });

  it("accepts the secret as a bearer token", () => {
    vi.stubEnv("EXAMPLE_CRON_SECRET", SECRET);
    const event = cronEvent({ authorization: `Bearer ${SECRET}` });

    expect(() => requireCronSecret(event, "EXAMPLE_CRON_SECRET")).not.toThrow();
  });
});
