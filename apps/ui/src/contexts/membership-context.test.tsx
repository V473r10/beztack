import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MembershipContextValue } from "./membership-context";

const mocks = vi.hoisted(() => ({
  activeOrganization: { id: "org_1" } as { id: string } | undefined,
  invalidateQueries: vi.fn(),
  membershipStatus: undefined as unknown,
  mutationOptions: [] as unknown[],
  redirectToExternalUrl: vi.fn(),
  subscriptions: [] as unknown[],
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  useMutation: vi.fn(),
  useQuery: vi.fn(),
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

vi.mock("@/lib/browser-navigation", () => ({
  redirectToExternalUrl: mocks.redirectToExternalUrl,
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: mocks.useMutation,
  useQuery: mocks.useQuery,
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueries,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}));

import { MembershipProvider, useMembership } from "./membership-context";

function renderMembershipProvider(): MembershipContextValue | null {
  let value: MembershipContextValue | null = null;

  function CaptureMembership() {
    value = useMembership();
    return null;
  }

  renderToStaticMarkup(
    <MembershipProvider>
      <CaptureMembership />
    </MembershipProvider>,
  );

  return value;
}

describe("MembershipProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.activeOrganization = { id: "org_1" };
    mocks.membershipStatus = undefined;
    mocks.mutationOptions.length = 0;
    mocks.subscriptions = [];
    mocks.useMutation.mockImplementation((options: unknown) => {
      mocks.mutationOptions.push(options);
      return {
        isPending: false,
        mutateAsync: vi.fn(),
      };
    });
    mocks.useQuery.mockImplementation((options: { queryKey: readonly unknown[] }) => {
      const queryName = options.queryKey[1];
      if (queryName === "products") {
        return {
          data: {
            provider: "polar",
            products: [],
          },
          error: null,
          isLoading: false,
        };
      }
      if (queryName === "list") {
        return {
          data: {
            provider: "polar",
            subscriptions: mocks.subscriptions,
          },
          error: null,
          isLoading: false,
        };
      }
      if (queryName === "membership") {
        return {
          data: mocks.membershipStatus,
          error: null,
          isLoading: false,
        };
      }

      throw new Error(`Unhandled query key: ${options.queryKey.join(".")}`);
    });
  });

  it("uses effective Membership status for the current tier", () => {
    mocks.membershipStatus = {
      data: {
        benefits: [],
        hasActiveSubscription: false,
        organizationId: "org_1",
        tier: "pro",
        userId: "admin_1",
      },
      success: true,
    };

    const value = renderMembershipProvider();

    expect(value?.currentTier).toBe("pro");
    expect(value?.activeSubscription).toBeNull();
  });

  it("exposes App-admin-only Admin tier override details", () => {
    mocks.membershipStatus = {
      data: {
        adminTierOverride: {
          billingCadence: "monthly",
          realSubscriptionsUnchanged: true,
          target: {
            id: "org_1",
            type: "organization",
          },
          tier: "pro",
        },
        benefits: [],
        hasActiveSubscription: false,
        isAppAdmin: true,
        organizationId: "org_1",
        tier: "pro",
        userId: "admin_1",
      },
      success: true,
    };

    const value = renderMembershipProvider();

    expect(value?.isAppAdmin).toBe(true);
    expect(value?.adminTierOverride).toEqual({
      billingCadence: "monthly",
      realSubscriptionsUnchanged: true,
      target: {
        id: "org_1",
        type: "organization",
      },
      tier: "pro",
    });
  });

  it("defaults to a non-App-admin state when the status response omits the flag", () => {
    mocks.membershipStatus = {
      data: {
        benefits: [],
        hasActiveSubscription: false,
        organizationId: "org_1",
        tier: "pro",
        userId: "admin_1",
      },
      success: true,
    };

    const value = renderMembershipProvider();

    expect(value?.isAppAdmin).toBe(false);
    expect(value?.adminTierOverride).toBeNull();
  });

  it("does not show checkout redirect copy for Admin tier overrides", () => {
    renderMembershipProvider();
    const checkoutMutationOptions = mocks.mutationOptions[0] as {
      onSuccess: (data: { changed: boolean; resultKind: string }) => void;
    };

    checkoutMutationOptions.onSuccess({
      changed: true,
      resultKind: "admin-tier-override",
    });

    expect(mocks.toastSuccess).toHaveBeenCalledWith("Admin tier override applied.");
    expect(mocks.toastSuccess).not.toHaveBeenCalledWith("Redirecting to checkout...");
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["subscriptions"],
    });
  });

  it("refreshes Membership after clearing Admin tier overrides", () => {
    renderMembershipProvider();
    const clearMutationOptions = mocks.mutationOptions[3] as {
      onSuccess: (data: { changed: boolean }) => void;
    };

    clearMutationOptions.onSuccess({ changed: true });

    expect(mocks.toastSuccess).toHaveBeenCalledWith("Admin tier override cleared.");
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["subscriptions"],
    });
  });

  describe("checkout", () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
      fetchMock.mockReset();
      vi.stubGlobal("fetch", fetchMock);
      vi.stubGlobal("window", { location: { origin: "https://app.example.test" } });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    function checkoutMutationFn() {
      renderMembershipProvider();
      return (
        mocks.mutationOptions[0] as {
          mutationFn: (params: {
            billingPeriod: "monthly" | "yearly";
            organizationId?: string;
            productId: string;
          }) => Promise<unknown>;
        }
      ).mutationFn;
    }

    it("redirects to the provider checkout through redirectToExternalUrl", async () => {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ checkoutUrl: "https://checkout.example.test/c/1" })),
      );

      await checkoutMutationFn()({
        billingPeriod: "monthly",
        organizationId: "org_1",
        productId: "prod_pro",
      });

      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.example.test/api/subscriptions/checkout",
        expect.objectContaining({ credentials: "include", method: "POST" }),
      );
      expect(mocks.redirectToExternalUrl).toHaveBeenCalledWith("https://checkout.example.test/c/1");
    });

    it("does not redirect when the response carries no checkout URL", async () => {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ changed: true, resultKind: "admin-tier-override" })),
      );

      await checkoutMutationFn()({ billingPeriod: "monthly", productId: "prod_pro" });

      expect(mocks.redirectToExternalUrl).not.toHaveBeenCalled();
    });

    it("rejects with an ApiError and does not redirect when checkout fails", async () => {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ message: "Only Billing managers can check out" }), {
          status: 403,
          statusText: "Forbidden",
        }),
      );

      await expect(
        checkoutMutationFn()({ billingPeriod: "monthly", productId: "prod_pro" }),
      ).rejects.toMatchObject({
        message: "Only Billing managers can check out",
        name: "ApiError",
        statusCode: 403,
      });
      expect(mocks.redirectToExternalUrl).not.toHaveBeenCalled();
    });
  });
});
