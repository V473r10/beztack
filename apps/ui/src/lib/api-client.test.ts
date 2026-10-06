import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/env", () => ({
  env: {
    VITE_API_URL: "https://api.example.test",
  },
}));

import { ApiError, apiUrl, requestJson } from "./api-client";

const fetchMock = vi.fn();

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("apiUrl", () => {
  it("prefixes a path with the API base URL", () => {
    expect(apiUrl("/api/subscriptions")).toBe("https://api.example.test/api/subscriptions");
  });
});

describe("requestJson", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the parsed body of a successful response", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ subscriptions: [] }));

    await expect(requestJson("/api/subscriptions")).resolves.toEqual({ subscriptions: [] });
  });

  it("sends credentials by default and keeps the caller's request options", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    await requestJson("/api/subscriptions/checkout", {
      body: JSON.stringify({ productId: "prod_1" }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/api/subscriptions/checkout", {
      body: JSON.stringify({ productId: "prod_1" }),
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  });

  it("turns a failed response into an ApiError carrying the server's status and data", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          data: { reason: "not-billing-manager" },
          message: "Only Billing managers can change plans",
          statusCode: 403,
          statusMessage: "Forbidden",
        },
        { status: 403, statusText: "Forbidden" },
      ),
    );

    const error = await requestJson("/api/subscriptions/plan-change/accept").catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      data: { reason: "not-billing-manager" },
      message: "Only Billing managers can change plans",
      name: "ApiError",
      statusCode: 403,
      statusMessage: "Forbidden",
    });
  });

  it("falls back to the status message when the error body has no message", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ statusMessage: "Subscription not found" }, { status: 404 }),
    );

    await expect(requestJson("/api/subscriptions/sub_1")).rejects.toMatchObject({
      message: "Subscription not found",
      statusCode: 404,
      statusMessage: "Subscription not found",
    });
  });

  it("still throws an ApiError when the error body is not JSON", async () => {
    fetchMock.mockResolvedValue(
      new Response("<html>Bad gateway</html>", { status: 502, statusText: "Bad Gateway" }),
    );

    const error = await requestJson("/api/subscriptions").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      data: undefined,
      message: "Request failed",
      statusCode: 502,
      statusMessage: "Bad Gateway",
    });
  });
});
