import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import type { MembershipContextValue } from "./membership-context";

const mocks = vi.hoisted(() => ({
  activeOrganization: { id: "org_1" } as { id: string } | undefined,
  invalidateQueries: vi.fn(),
  membershipStatus: undefined as unknown,
  mutationOptions: [] as unknown[],
  // In the order the provider declares its mutations: checkout, Plan change,
  // billing portal, clear Admin tier override.
  mutateAsyncs: [] as ReturnType<typeof vi.fn>[],
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
    mocks.mutateAsyncs.length = 0;
    mocks.subscriptions = [];
    mocks.useMutation.mockImplementation((options: unknown) => {
      const mutateAsync = vi.fn().mockResolvedValue({ success: true });
      mocks.mutationOptions.push(options);
      mocks.mutateAsyncs.push(mutateAsync);
      return {
        isPending: false,
        mutateAsync,
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

  describe("Plan change or checkout", () => {
    const CHECKOUT = 0;
    const PLAN_CHANGE = 1;
    const status = (overrides: Record<string, unknown>) => ({
      data: {
        benefits: [],
        hasActiveSubscription: false,
        organizationId: "org_1",
        tier: "free",
        userId: "user_1",
        ...overrides,
      },
      success: true,
    });
    // The checkout and Plan change mutations are the first two the provider
    // declares; the last render's calls are the ones the captured value uses.
    const calls = (index: number) => mocks.mutateAsyncs.slice(-4)[index];

    it("reports an active Subscription from Membership status although the provider list has none", () => {
      mocks.membershipStatus = status({ hasActiveSubscription: true, tier: "basic" });

      const value = renderMembershipProvider();

      expect(value?.activeSubscription).toBeNull();
      expect(value?.hasActiveSubscription).toBe(true);
    });

    it("reports an active Subscription found in the provider list", () => {
      mocks.membershipStatus = status({ canManageBilling: true });
      mocks.subscriptions = [{ id: "sub_1", status: "active", metadata: { tier: "basic" } }];

      expect(renderMembershipProvider()?.hasActiveSubscription).toBe(true);
    });

    it("reports no Subscription when neither source has one", () => {
      mocks.membershipStatus = status({});

      expect(renderMembershipProvider()?.hasActiveSubscription).toBe(false);
    });

    it("changes plan, not checkout, when Membership status has an active Subscription", async () => {
      mocks.membershipStatus = status({ hasActiveSubscription: true, tier: "basic" });
      const value = renderMembershipProvider();

      await value?.upgradeToTier("prod_pro_month", "monthly");

      expect(calls(PLAN_CHANGE)).toHaveBeenCalledWith({
        billingPeriod: "monthly",
        organizationId: "org_1",
        productId: "prod_pro_month",
      });
      expect(calls(CHECKOUT)).not.toHaveBeenCalled();
    });

    it("starts a checkout of the product when there is no Subscription", async () => {
      mocks.membershipStatus = status({});
      const value = renderMembershipProvider();

      await value?.upgradeToTier("prod_pro_year", "yearly");

      expect(calls(CHECKOUT)).toHaveBeenCalledWith(
        expect.objectContaining({
          billingPeriod: "yearly",
          organizationId: "org_1",
          productId: "prod_pro_year",
        }),
      );
      expect(calls(PLAN_CHANGE)).not.toHaveBeenCalled();
    });

    it("lets the dialog change plan on a Subscription only Membership status knows about", async () => {
      mocks.membershipStatus = status({ hasActiveSubscription: true, tier: "basic" });
      const value = renderMembershipProvider();

      await value?.changePlan("prod_pro_month", { billingPeriod: "monthly" });

      expect(calls(PLAN_CHANGE)).toHaveBeenCalledWith({
        billingPeriod: "monthly",
        organizationId: "org_1",
        productId: "prod_pro_month",
      });
    });

    it("sends an App admin's plan choice to the Plan change, which applies an Admin tier override", async () => {
      mocks.membershipStatus = status({ isAppAdmin: true });
      const value = renderMembershipProvider();

      await value?.changePlan("prod_pro_month", { billingPeriod: "monthly" });

      expect(calls(PLAN_CHANGE)).toHaveBeenCalledTimes(1);
      expect(calls(CHECKOUT)).not.toHaveBeenCalled();
    });

    it("refuses to change plan when there is nothing to change", () => {
      mocks.membershipStatus = status({});
      const value = renderMembershipProvider();

      expect(() => value?.changePlan("prod_pro_month")).toThrow("No active subscription");
    });
  });

  it("offers a Cadence change only when the Payment provider supports it", () => {
    const status = (cadenceChange: boolean) => ({
      data: {
        benefits: [],
        billingCadence: "monthly",
        hasActiveSubscription: true,
        organizationId: "org_1",
        paymentCapabilities: { cadenceChange },
        tier: "pro",
        userId: "user_1",
      },
      success: true,
    });

    mocks.membershipStatus = status(true);
    let value = renderMembershipProvider();
    expect(value?.billingCadence).toBe("monthly");
    expect(value?.canChangeBillingCadence).toBe(true);
    expect(value?.getPlanChangeType("pro", "yearly")).toBe("period_change");
    expect(value?.getPlanChangeType("pro", "monthly")).toBe("same");
    expect(value?.getPlanChangeType("ultimate", "yearly")).toBe("upgrade");

    mocks.membershipStatus = status(false);
    value = renderMembershipProvider();
    expect(value?.canChangeBillingCadence).toBe(false);
    expect(value?.getPlanChangeType("pro", "yearly")).toBe("same");
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

  describe("Plan change toasts", () => {
    function onPlanChangeSuccess(acceptance: unknown) {
      renderMembershipProvider();
      (
        mocks.mutationOptions[1] as {
          onSuccess: (data: { planChangeAcceptance: unknown }) => void;
        }
      ).onSuccess({ planChangeAcceptance: acceptance });
    }

    it("says a Downgrade or Cadence change is scheduled for the renewal", () => {
      onPlanChangeSuccess({ direction: "downgrade", kind: "plan-change-acceptance" });

      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        "Plan change scheduled. It takes effect at your next renewal.",
      );
    });

    it("says an Upgrade is accepted and the provider settles the charge", () => {
      onPlanChangeSuccess({ direction: "upgrade", kind: "plan-change-acceptance" });

      expect(mocks.toastSuccess).toHaveBeenCalledWith("billing.toast.planChangeAccepted");
    });
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

    expect(mocks.toastSuccess).toHaveBeenCalledWith("billing.toast.adminOverrideApplied");
    expect(mocks.toastSuccess).not.toHaveBeenCalledWith("billing.toast.redirecting");
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

    expect(mocks.toastSuccess).toHaveBeenCalledWith("billing.toast.adminOverrideCleared");
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["subscriptions"],
    });
  });

  describe("checkout errors", () => {
    function onError(index: number) {
      renderMembershipProvider();
      return (mocks.mutationOptions[index] as { onError: (error: Error) => void }).onError;
    }

    it("shows the server's reason when checkout fails", () => {
      onError(0)(new ApiError("This plan is not available yet", { statusCode: 409 }));

      expect(mocks.toastError).toHaveBeenCalledWith("This plan is not available yet");
    });

    it("keeps quiet when the user is only being asked to create an organization", () => {
      onError(0)(
        new ApiError("Create an organization first", {
          statusCode: 409,
          data: { code: "organization_required" },
        }),
      );
      onError(1)(
        new ApiError("Create an organization first", {
          statusCode: 409,
          data: { code: "organization_required" },
        }),
      );

      expect(mocks.toastError).not.toHaveBeenCalled();
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
