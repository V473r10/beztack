import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invalidateQueries: vi.fn() }));

vi.mock("@/env", () => ({ env: { VITE_API_URL: "https://api.example.test" } }));
vi.mock("@tanstack/react-query", () => ({
  useMutation: (options: unknown) => options,
  useQuery: (options: unknown) => options,
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));

import { useCancelPendingPlanChange, usePendingPlanChange } from "./use-pending-plan-change";

const fetchMock = vi.fn();

describe("use-pending-plan-change", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keys and requests the Pending Plan change by organization", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ pendingPlanChange: null })));
    const orgOne = usePendingPlanChange("org_1") as unknown as {
      queryKey: unknown[];
      queryFn: () => Promise<unknown>;
    };
    const orgTwo = usePendingPlanChange("org_2") as unknown as { queryKey: unknown[] };

    expect(orgOne.queryKey).not.toEqual(orgTwo.queryKey);
    await expect(orgOne.queryFn()).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/api/subscriptions/plan-change/pending?organizationId=org_1",
      { credentials: "include" },
    );
  });

  it("cancels with DELETE for the organization and refreshes the notice", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({})));
    const cancel = useCancelPendingPlanChange("org_1") as unknown as {
      mutationFn: () => Promise<unknown>;
      onSuccess: () => unknown;
    };

    await cancel.mutationFn();
    cancel.onSuccess();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/api/subscriptions/plan-change/pending",
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({ organizationId: "org_1" }),
      }),
    );
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: usePendingPlanChange("org_1").queryKey,
    });
  });
});
