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

/** What `GET /api/subscriptions/:id` answers for a Mercado Pago subscription (JSON, so dates are strings). */
function apiResponse(subscription: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({
      provider: "mercadopago",
      subscription: {
        id: "pre_1",
        status: "active",
        productId: "plan_pro",
        productName: "Pro",
        customerId: "user_1",
        customerEmail: "payer@example.com",
        currentPeriodStart: "2026-11-13T00:00:00.000Z",
        currentPeriodEnd: "2026-12-13T00:00:00.000Z",
        metadata: {
          billingAmount: 2900,
          billingCurrency: "USD",
          billingInterval: "month",
          billingFrequency: 1,
          paymentMethodId: "visa",
        },
        ...subscription,
      },
    }),
    { status: 200 },
  );
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
  });

  it("reads the subscription from the route the API serves", async () => {
    fetchMock.mockResolvedValue(apiResponse());

    await queryFnFor("pre/1")();

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/api/subscriptions/pre%2F1", {
      credentials: "include",
    });
  });

  it("shows the subscription with its price in minor units", async () => {
    fetchMock.mockResolvedValue(apiResponse());

    await expect(queryFnFor("pre_1")()).resolves.toEqual({
      id: "pre_1",
      status: "active",
      plan: { name: "Pro" },
      price: { amount: 2900, currency: "USD", frequency: 1, frequencyType: "months" },
      dates: { nextPayment: new Date("2026-12-13T00:00:00.000Z") },
      paymentMethod: "visa",
    });
  });

  it.each([
    ["month", 1, { frequency: 1, frequencyType: "months" }],
    ["year", 1, { frequency: 12, frequencyType: "months" }],
    ["day", 3, { frequency: 3, frequencyType: "days" }],
    ["week", 2, { frequency: 14, frequencyType: "days" }],
  ])(
    "expresses a %s interval of %i as months or days",
    async (billingInterval, billingFrequency, expected) => {
      fetchMock.mockResolvedValue(
        apiResponse({
          metadata: {
            billingAmount: 100,
            billingCurrency: "USD",
            billingInterval,
            billingFrequency,
          },
        }),
      );

      const details = (await queryFnFor("pre_1")()) as { price: unknown };

      expect(details.price).toMatchObject(expected);
    },
  );

  it("leaves out the price and payment method the provider did not report", async () => {
    fetchMock.mockResolvedValue(
      apiResponse({ productName: undefined, currentPeriodEnd: undefined, metadata: {} }),
    );

    await expect(queryFnFor("pre_1")()).resolves.toMatchObject({
      plan: { name: null },
      price: null,
      dates: { nextPayment: null },
      paymentMethod: null,
    });
  });
});
