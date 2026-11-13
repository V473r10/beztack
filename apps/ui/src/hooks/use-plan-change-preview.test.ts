import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({ useQuery: mocks.useQuery }));
vi.mock("@/lib/api-client", () => ({ requestJson: vi.fn() }));

import { usePlanChangePreview } from "./use-plan-change-preview";

function queryOptions(input: Parameters<typeof usePlanChangePreview>[0]) {
  usePlanChangePreview(input);
  return mocks.useQuery.mock.calls.at(-1)?.[0] as { enabled: boolean };
}

describe("usePlanChangePreview", () => {
  beforeEach(() => {
    mocks.useQuery.mockReset();
    mocks.useQuery.mockReturnValue({});
  });

  it("asks the server for a quote as soon as the dialog is open for a target tier", () => {
    expect(
      queryOptions({ billingPeriod: "monthly", enabled: true, targetTierId: "pro" }).enabled,
    ).toBe(true);
  });

  it("does not need the provider's Subscription list: the server finds the Current Subscription", () => {
    // A subscriber known only from Membership status has no Subscription id
    // in the client; the quote must not wait for one.
    expect(
      queryOptions({
        billingPeriod: "monthly",
        enabled: true,
        subscriptionId: undefined,
        targetTierId: "pro",
      }).enabled,
    ).toBe(true);
  });

  it("waits while the dialog is closed or no target is chosen", () => {
    expect(
      queryOptions({ billingPeriod: "monthly", enabled: false, targetTierId: "pro" }).enabled,
    ).toBe(false);
    expect(queryOptions({ billingPeriod: "monthly", enabled: true }).enabled).toBe(false);
  });
});
