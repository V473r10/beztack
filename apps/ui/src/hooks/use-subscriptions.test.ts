import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
  redirectToExternalUrl: vi.fn(),
}));

vi.mock("@/env", () => ({
  env: {
    VITE_API_URL: "https://api.example.test",
    VITE_PAYMENT_PROVIDER: "polar",
  },
}));

vi.mock("@/lib/browser-navigation", () => ({
  redirectToExternalUrl: mocks.redirectToExternalUrl,
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: (options: unknown) => options,
  useQuery: (options: unknown) => options,
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));

import { useCancelSubscription, useCheckout, useSubscriptions } from "./use-subscriptions";

type QueryOptions = { queryKey: readonly unknown[]; queryFn: () => Promise<unknown> };

const fetchMock = vi.fn();

describe("use-subscriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keys and requests the Subscription list by organization", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ subscriptions: [] })));
    const orgOne = useSubscriptions("org_1") as unknown as QueryOptions;
    const orgTwo = useSubscriptions("org_2") as unknown as QueryOptions;

    expect(orgOne.queryKey).not.toEqual(orgTwo.queryKey);

    await orgOne.queryFn();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/api/subscriptions?organizationId=org_1",
      { credentials: "include" },
    );
  });

  it("redirects to the checkout URL through redirectToExternalUrl", () => {
    const checkout = useCheckout() as unknown as {
      onSuccess: (data: { checkoutUrl: string }) => void;
    };

    checkout.onSuccess({ checkoutUrl: "https://checkout.example.test/c/1" });

    expect(mocks.redirectToExternalUrl).toHaveBeenCalledWith("https://checkout.example.test/c/1");
  });

  it("rejects a failed cancel with an ApiError", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: "Subscription not found" }), { status: 404 }),
    );
    const cancel = useCancelSubscription() as unknown as {
      mutationFn: (params: { subscriptionId: string }) => Promise<unknown>;
    };

    await expect(cancel.mutationFn({ subscriptionId: "sub_1" })).rejects.toMatchObject({
      message: "Subscription not found",
      name: "ApiError",
      statusCode: 404,
    });
  });
});
