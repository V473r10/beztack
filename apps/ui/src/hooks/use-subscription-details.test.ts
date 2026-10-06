import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/env", () => ({
  env: { VITE_API_URL: "https://api.example.test" },
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: unknown) => options,
}));

import { useSubscriptionDetails } from "./use-subscription-details";

const fetchMock = vi.fn();

function queryFnFor(preapprovalId: string) {
  return (useSubscriptionDetails(preapprovalId) as unknown as { queryFn: () => Promise<unknown> })
    .queryFn;
}

describe("useSubscriptionDetails", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    [404, "SUBSCRIPTION_NOT_FOUND"],
    [403, "SUBSCRIPTION_ACCESS_DENIED"],
    [500, "SUBSCRIPTION_FETCH_ERROR"],
  ])("maps a %i response to %s", async (status, code) => {
    fetchMock.mockResolvedValue(new Response("{}", { status }));

    await expect(queryFnFor("pre_1")()).rejects.toThrow(code);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/api/payments/mercado-pago/subscriptions/pre_1",
      { credentials: "include" },
    );
  });
});
