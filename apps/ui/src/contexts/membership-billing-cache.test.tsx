import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/query-keys";
import type { MembershipContextValue } from "./membership-context";

const mocks = vi.hoisted(() => ({
  activeOrganization: { id: "org_1" } as { id: string } | undefined,
}));

vi.mock("@/env", () => ({
  env: {
    VITE_API_URL: "https://api.example.test",
    VITE_PAYMENT_PROVIDER: "polar",
    VITE_SUBSCRIPTION_MODE: "organization",
  },
}));

vi.mock("@/hooks/use-organizations", () => ({
  useActiveOrganization: () => ({ data: mocks.activeOrganization }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {},
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { MembershipProvider, useMembership } from "./membership-context";

function renderWithCache(queryClient: QueryClient): MembershipContextValue | null {
  let value: MembershipContextValue | null = null;

  function CaptureMembership() {
    value = useMembership();
    return null;
  }

  renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <MembershipProvider>
        <CaptureMembership />
      </MembershipProvider>
    </QueryClientProvider>,
  );

  return value;
}

function seedOrganizationBilling(queryClient: QueryClient, organizationId: string, tier: string) {
  queryClient.setQueryData(queryKeys.subscriptions.list(organizationId), {
    provider: "polar",
    subscriptions: [
      {
        id: `sub_${organizationId}`,
        productId: `prod_${tier}`,
        productName: tier,
        status: "active",
      },
    ],
  });
  queryClient.setQueryData(queryKeys.subscriptions.membership(organizationId), {
    data: {
      benefits: [],
      hasActiveSubscription: true,
      organizationId,
      tier,
      userId: "user_1",
    },
    success: true,
  });
}

describe("MembershipProvider billing cache", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => undefined)),
    );
  });

  it("does not show the previous organization's billing after switching organization", () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(queryKeys.subscriptions.products(), {
      products: [],
      provider: "polar",
    });
    seedOrganizationBilling(queryClient, "org_1", "pro");

    mocks.activeOrganization = { id: "org_1" };
    const before = renderWithCache(queryClient);
    expect(before?.activeSubscription?.id).toBe("sub_org_1");
    expect(before?.currentTier).toBe("pro");

    mocks.activeOrganization = { id: "org_2" };
    const after = renderWithCache(queryClient);
    expect(after?.activeSubscription).toBeNull();
    expect(after?.subscriptions).toEqual([]);
    expect(after?.currentTier).toBe("free");
  });
});
