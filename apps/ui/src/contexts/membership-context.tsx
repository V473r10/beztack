import { isCurrentSubscription } from "@beztack/payments/subscription";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { CreateOrganizationDialog } from "@/components/organizations/create-organization-dialog";
import { env } from "@/env";
import { useActiveOrganization } from "@/hooks/use-organizations";
import { requestJson } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
import {
  getBillingErrorMessage,
  isOrganizationRequiredError,
  runWithOrganization,
} from "@/lib/billing-errors";
import { redirectToExternalUrl } from "@/lib/browser-navigation";
import { queryKeys } from "@/lib/query-keys";
import type { MembershipTier, MembershipTierConfig } from "@/types/membership";
import type {
  CatalogPlan,
  CustomerMeter,
  Order,
  Product,
  ProductsResponse,
  Subscription,
  SubscriptionsResponse,
} from "./membership/membership-types";
import {
  buildTierConfigFromPlansAndProducts as buildTierConfigs,
  parseTierIdFromName as parseTierIdFromNameInternal,
  parseTierIdFromProduct as parseTierIdFromProductInternal,
} from "./membership/tier-config";

type MembershipStatusResponse = {
  success: boolean;
  data: {
    userId: string;
    tier: string;
    hasActiveSubscription: boolean;
    benefits: unknown[];
    expiresAt?: string;
    organizationId?: string;
    isAppAdmin?: boolean;
    organizationRole?: string | null;
    canManageBilling?: boolean;
    billingCadence?: "monthly" | "yearly" | null;
    paymentCapabilities?: { cadenceChange?: boolean };
    adminTierOverride?: AdminTierOverrideResponse;
  };
};

type AdminTierOverrideTarget = {
  type: "user" | "organization";
  id: string;
};

type AdminTierOverrideResponse = {
  target: AdminTierOverrideTarget;
  tier: string;
  billingCadence: "monthly" | "yearly" | null;
  realSubscriptionsUnchanged: boolean;
};

export type AdminTierOverrideStatus = {
  target: AdminTierOverrideTarget;
  tier: MembershipTier;
  billingCadence: "monthly" | "yearly" | null;
  realSubscriptionsUnchanged: boolean;
};

type ClearAdminTierOverrideResponse = {
  success: boolean;
  resultKind: "admin-tier-override-cleared";
  changed: boolean;
};

type OrganizationPrompt = {
  resolve: (organizationId: string | null) => void;
};

type CheckoutResponse = {
  checkoutUrl?: string;
  resultKind?: string;
  changed?: boolean;
};

const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const FIVE_MINUTES = 5;
const TWO_MINUTES = 2;

const CUSTOMER_STATE_STALE_TIME = MILLISECONDS_PER_SECOND * SECONDS_PER_MINUTE * FIVE_MINUTES;
const SUBSCRIPTIONS_STALE_TIME = MILLISECONDS_PER_SECOND * SECONDS_PER_MINUTE * TWO_MINUTES;

const EMPTY_PRODUCTS: Product[] = [];
const EMPTY_SUBSCRIPTIONS: Subscription[] = [];
const EMPTY_ORDERS: Order[] = [];
const EMPTY_METERS: CustomerMeter[] = [];
const EMPTY_BENEFITS: string[] = [];

export type { CustomerMeter, Order, Subscription } from "./membership/membership-types";

export type PlanChangeType = "upgrade" | "downgrade" | "same" | "period_change";

export type PlanChangeResult = {
  success: boolean;
  planChangeAcceptance?: unknown;
  subscription?: {
    id: string;
    status: string;
    productId: string;
    amount: number;
    currency: string;
    currentPeriodEnd: string;
    recurringInterval: string;
  };
  error?: string;
};

export type MembershipContextValue = {
  currentTier: MembershipTier;
  tierConfig: MembershipTierConfig | null;
  isLoading: boolean;
  error: Error | null;
  subscriptions: Subscription[];
  activeSubscription: Subscription | null;
  /**
   * The caller has a Subscription, by Membership status or by the provider's
   * list (which only loads for Billing managers and can lag or fail). A caller
   * with one changes plan (the dialog with its proration preview) instead of
   * starting a checkout.
   */
  hasActiveSubscription: boolean;
  orders: Order[];
  meters: CustomerMeter[];
  benefits: string[];
  upgradeToTier: (
    tierId: string,
    billingPeriod?: "monthly" | "yearly",
    organizationId?: string,
  ) => Promise<void>;
  changePlan: (
    productId: string,
    options?: {
      billingPeriod?: "monthly" | "yearly";
      organizationId?: string;
      prorationBehavior?: "invoice" | "prorate";
    },
  ) => Promise<PlanChangeResult>;
  openBillingPortal: (returnUrl?: string) => Promise<void>;
  refreshMembership: () => Promise<void>;
  clearAdminTierOverride: () => Promise<void>;
  hasFeature: (feature: string) => boolean;
  hasPermission: (permission: string) => boolean;
  isWithinLimit: (limitKey: string, currentUsage: number) => boolean;
  canUpgrade: boolean;
  /**
   * `period_change` only when the target is the current tier on another
   * Billing cadence and the Payment provider can change cadence.
   */
  getPlanChangeType: (
    targetTierId: string,
    targetBillingCadence?: "monthly" | "yearly",
  ) => PlanChangeType;
  /** The Membership's Billing cadence; null for the free tier or when unknown. */
  billingCadence: "monthly" | "yearly" | null;
  /** The Payment provider can move an existing Subscription to another cadence. */
  canChangeBillingCadence: boolean;
  adminTierOverride: AdminTierOverrideStatus | null;
  isAppAdmin: boolean;
  /** The caller's Organization role in the Active organization, if a member. */
  organizationRole: string | null;
  /** Passes the server's Billing manager gate (always true in user mode). */
  canManageBilling: boolean;
  /** Whether the server's access answer (status) has arrived. */
  isAccessLoading: boolean;
  isClearingAdminTierOverride: boolean;
};

function createMembershipContext() {
  return createContext<MembershipContextValue | null>(null);
}

const MembershipContext: ReturnType<typeof createMembershipContext> =
  import.meta.hot?.data.membershipContext ?? createMembershipContext();

if (import.meta.hot) {
  import.meta.hot.data.membershipContext = MembershipContext;
}

function parseTierIdFromName(raw: string | undefined): MembershipTier {
  return parseTierIdFromNameInternal(raw);
}

function parseTierIdFromProduct(product: Product): MembershipTier {
  return parseTierIdFromProductInternal(product);
}

function buildTierConfigFromPlansAndProducts(
  products: Product[],
  plans: CatalogPlan[] | undefined,
): MembershipTierConfig[] {
  return buildTierConfigs(products, plans);
}

function isAdminTierOverrideCheckoutResponse(data: CheckoutResponse): boolean {
  return data.resultKind === "admin-tier-override";
}

function getAdminTierOverrideToastMessage(data: CheckoutResponse): string {
  return data.changed ? "Admin tier override applied." : "Admin tier override already active.";
}

function organizationQueryString(organizationId: string | undefined): string {
  return organizationId ? `?${new URLSearchParams({ organizationId }).toString()}` : "";
}

function parseAdminTierOverride(
  data: AdminTierOverrideResponse | undefined,
): AdminTierOverrideStatus | null {
  if (!data) {
    return null;
  }

  return {
    ...data,
    tier: parseTierIdFromName(data.tier),
  };
}

/** The membership context, or `null` outside a MembershipProvider. */
export function useOptionalMembership(): MembershipContextValue | null {
  return useContext(MembershipContext);
}

export function useMembership() {
  const context = useContext(MembershipContext);
  if (!context) {
    throw new Error("useMembership must be used within a MembershipProvider");
  }
  return context;
}

export type MembershipProviderProps = {
  children: React.ReactNode;
};

export function MembershipProvider({ children }: MembershipProviderProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  // Set while the "create organization" dialog is open on behalf of a billing
  // action that found the user without an organization.
  const [organizationPrompt, setOrganizationPrompt] = useState<OrganizationPrompt | null>(null);
  const { data: activeOrganization } = useActiveOrganization();
  const isOrganizationSubscriptionMode = env.VITE_SUBSCRIPTION_MODE === "organization";
  const activeOrganizationId = isOrganizationSubscriptionMode ? activeOrganization?.id : undefined;

  const productsQuery = useQuery({
    queryKey: queryKeys.subscriptions.products(),
    queryFn: () => requestJson<ProductsResponse>("/api/subscriptions/products"),
    staleTime: CUSTOMER_STATE_STALE_TIME,
  });

  const membershipStatusQuery = useQuery({
    queryKey: queryKeys.subscriptions.membership(activeOrganizationId),
    queryFn: () =>
      requestJson<MembershipStatusResponse>(
        `/api/membership/status${organizationQueryString(activeOrganizationId)}`,
      ),
    staleTime: SUBSCRIPTIONS_STALE_TIME,
  });

  // The Subscription list is billing data: only fetched for callers who pass
  // the Billing manager gate (the API answers 403 otherwise).
  const canManageBilling = membershipStatusQuery.data?.data.canManageBilling === true;

  const subscriptionsQuery = useQuery({
    queryKey: queryKeys.subscriptions.list(activeOrganizationId),
    queryFn: () =>
      requestJson<SubscriptionsResponse>(
        `/api/subscriptions${organizationQueryString(activeOrganizationId)}`,
      ),
    staleTime: SUBSCRIPTIONS_STALE_TIME,
    enabled: canManageBilling,
  });

  const checkoutMutation = useMutation({
    mutationFn: async (params: {
      productId: string;
      billingPeriod: "monthly" | "yearly";
      metadata?: Record<string, unknown>;
      organizationId?: string;
      upgrade?: boolean;
    }): Promise<CheckoutResponse> => {
      const selectedProduct = productsQuery.data?.products.find(
        (product) => product.id === params.productId,
      );
      const selectedPlanId = selectedProduct ? parseTierIdFromProduct(selectedProduct) : "free";

      const data = await requestJson<CheckoutResponse>("/api/subscriptions/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId: params.productId,
          planId: selectedPlanId !== "free" ? selectedPlanId : undefined,
          billingPeriod: params.billingPeriod,
          organizationId: params.organizationId,
          successUrl: `${window.location.origin}/checkout-success`,
          cancelUrl: `${window.location.origin}/pricing?checkout=canceled`,
          upgrade: params.upgrade,
          metadata: {
            billingPeriod: params.billingPeriod,
            ...params.metadata,
          },
        }),
      });

      if (data.checkoutUrl) {
        redirectToExternalUrl(data.checkoutUrl);
      }

      return data;
    },
    onSuccess: (data) => {
      if (isAdminTierOverrideCheckoutResponse(data)) {
        toast.success(getAdminTierOverrideToastMessage(data));
        queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all() });
        return;
      }

      toast.success("Redirecting to checkout...");
    },
    onError: (checkoutError: Error) => {
      // The user is asked to create an organization and the action retried.
      if (isOrganizationRequiredError(checkoutError)) {
        return;
      }
      toast.error(getBillingErrorMessage(t, checkoutError, t("billing.checkoutFailed")));
    },
  });

  const planChangeMutation = useMutation({
    mutationFn: async (params: {
      billingPeriod: "monthly" | "yearly";
      organizationId?: string;
      productId: string;
    }): Promise<PlanChangeResult> => {
      const payload = await requestJson<{ planChangeAcceptance?: unknown }>(
        "/api/subscriptions/plan-change/accept",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            targetPricingCatalogPlanId: params.productId,
            targetBillingCadence: params.billingPeriod,
            organizationId: params.organizationId,
          }),
        },
      );

      return {
        success: true,
        planChangeAcceptance: payload.planChangeAcceptance,
      };
    },
    onSuccess: (data) => {
      const acceptance = data.planChangeAcceptance as
        | { changed?: boolean; direction?: string; kind?: string; reconciliationStatus?: string }
        | undefined;
      if (acceptance?.kind === "admin-tier-override") {
        toast.success(
          acceptance.changed
            ? "Admin tier override applied."
            : "Admin tier override already active.",
        );
      } else if (acceptance?.reconciliationStatus === "reconciling") {
        toast.success("Payment confirmed. Plan change is still reconciling.");
      } else if (
        acceptance?.direction === "downgrade" ||
        acceptance?.direction === "cadence_change"
      ) {
        // A Pending Plan change: the current plan runs until the renewal.
        toast.success(
          t(
            "billing.planChange.scheduledToast",
            "Plan change scheduled. It takes effect at your next renewal.",
          ),
        );
      } else {
        toast.success("Plan change accepted successfully!");
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all() });
    },
    onError: (mutationError: Error) => {
      if (isOrganizationRequiredError(mutationError)) {
        return;
      }
      toast.error(getBillingErrorMessage(t, mutationError, "Failed to change plan"));
    },
  });

  const billingPortalMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      if (env.VITE_PAYMENT_PROVIDER !== "polar") {
        throw new Error("Billing portal is only available for Polar");
      }

      const portalFn = (
        authClient as {
          customer?: {
            portal?: () => Promise<{
              data?: { url?: string };
              error?: { message?: string };
            }>;
          };
        }
      ).customer?.portal;

      if (!portalFn) {
        throw new Error("Billing portal is not available");
      }

      const result = await portalFn();
      if (result.error) {
        throw new Error(result.error.message || "Failed to open billing portal");
      }
      if (result.data?.url) {
        window.open(result.data.url, "_blank");
      }
    },
    onSuccess: () => {
      toast.success("Opening billing portal...");
    },
    onError: (billingPortalError: Error) => {
      toast.error(billingPortalError.message || "Failed to open billing portal");
    },
  });

  const clearAdminTierOverrideMutation = useMutation({
    mutationFn: async (): Promise<ClearAdminTierOverrideResponse> => {
      return requestJson<ClearAdminTierOverrideResponse>(
        `/api/membership/admin-tier-override${organizationQueryString(activeOrganizationId)}`,
        { method: "DELETE" },
      );
    },
    onSuccess: (data) => {
      toast.success(
        data.changed ? "Admin tier override cleared." : "Admin tier override already cleared.",
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all() });
    },
    onError: () => {
      toast.error("Failed to clear Admin tier override");
    },
  });

  const products = productsQuery.data?.products ?? EMPTY_PRODUCTS;
  const subscriptions = subscriptionsQuery.data?.subscriptions ?? EMPTY_SUBSCRIPTIONS;

  const activeSubscription = (() => {
    const validSubs = subscriptions.filter((sub) => isCurrentSubscription(sub));

    return validSubs.at(0) ?? null;
  })();

  // TODO: Mercado Pago no tiene metadata, no estamos obteniendo ningún tier, esto hay que sacarlo de la base.

  const currentTier = parseTierIdFromName(
    membershipStatusQuery.data?.data.tier ||
      (activeSubscription?.metadata?.tier as string | undefined) ||
      (activeSubscription?.metadata?.planId as string | undefined) ||
      activeSubscription?.productName,
  );

  const dbPlans = productsQuery.data?.plans;

  const tierConfigs = useMemo(
    () => buildTierConfigFromPlansAndProducts(products, dbPlans),
    [products, dbPlans],
  );

  const tierConfig = tierConfigs.find((config) => config.id === currentTier) || null;

  const rawAdminTierOverride = membershipStatusQuery.data?.data.adminTierOverride;
  const adminTierOverride = useMemo(
    () => parseAdminTierOverride(rawAdminTierOverride),
    [rawAdminTierOverride],
  );

  const isAppAdmin = membershipStatusQuery.data?.data.isAppAdmin === true;
  const hasActiveSubscription =
    membershipStatusQuery.data?.data.hasActiveSubscription === true || activeSubscription !== null;
  // An App admin's Plan change is an Admin tier override (ADR 0004), applied
  // by the same endpoint, so it never goes through checkout either.
  const changesPlan = hasActiveSubscription || isAppAdmin;
  const organizationRole = membershipStatusQuery.data?.data.organizationRole ?? null;
  const billingCadence = membershipStatusQuery.data?.data.billingCadence ?? null;
  const canChangeBillingCadence =
    membershipStatusQuery.data?.data.paymentCapabilities?.cadenceChange === true;
  const isAccessLoading = membershipStatusQuery.isLoading;

  const isLoading =
    productsQuery.isLoading ||
    subscriptionsQuery.isLoading ||
    membershipStatusQuery.isLoading ||
    checkoutMutation.isPending ||
    planChangeMutation.isPending ||
    billingPortalMutation.isPending ||
    clearAdminTierOverrideMutation.isPending;

  const error =
    (productsQuery.error as Error | null) ||
    (subscriptionsQuery.error as Error | null) ||
    (membershipStatusQuery.error as Error | null);

  const checkoutRef = useRef(checkoutMutation.mutateAsync);
  checkoutRef.current = checkoutMutation.mutateAsync;

  const planChangeRef = useRef(planChangeMutation.mutateAsync);
  planChangeRef.current = planChangeMutation.mutateAsync;

  const askForOrganization = useCallback(
    () =>
      new Promise<string | null>((resolve) => {
        setOrganizationPrompt({ resolve });
      }),
    [],
  );

  const upgradeToTier = useCallback(
    async (
      tierId: string,
      billingPeriod: "monthly" | "yearly" = "monthly",
      organizationId?: string,
    ) => {
      await runWithOrganization(
        async (checkoutOrganizationId) => {
          if (changesPlan) {
            await planChangeRef.current({
              billingPeriod,
              productId: tierId,
              organizationId: checkoutOrganizationId,
            });
            return;
          }

          await checkoutRef.current({
            productId: tierId,
            billingPeriod,
            organizationId: checkoutOrganizationId,
            metadata: checkoutOrganizationId ? { organizationId: checkoutOrganizationId } : {},
          });
        },
        organizationId ?? activeOrganizationId,
        askForOrganization,
      );
    },
    [changesPlan, activeOrganizationId, askForOrganization],
  );

  const changePlan = useCallback(
    (
      productId: string,
      options?: {
        billingPeriod?: "monthly" | "yearly";
        organizationId?: string;
        prorationBehavior?: "invoice" | "prorate";
      },
    ): Promise<PlanChangeResult> => {
      if (!changesPlan) {
        throw new Error("No active subscription to change");
      }

      return runWithOrganization(
        (planChangeOrganizationId) =>
          planChangeRef.current({
            billingPeriod: options?.billingPeriod ?? "monthly",
            organizationId: planChangeOrganizationId,
            productId,
          }),
        options?.organizationId ?? activeOrganizationId,
        askForOrganization,
      ).then((result) => result ?? { success: false });
    },
    [changesPlan, activeOrganizationId, askForOrganization],
  );

  const billingPortalRef = useRef(billingPortalMutation.mutateAsync);
  billingPortalRef.current = billingPortalMutation.mutateAsync;

  const openBillingPortal = useCallback(async () => {
    await billingPortalRef.current();
  }, []);

  const refreshMembership = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all() });
  }, [queryClient]);

  const clearAdminTierOverrideRef = useRef(clearAdminTierOverrideMutation.mutateAsync);
  clearAdminTierOverrideRef.current = clearAdminTierOverrideMutation.mutateAsync;

  const clearAdminTierOverride = useCallback(async () => {
    await clearAdminTierOverrideRef.current();
  }, []);

  const hasFeature = useCallback(
    (feature: string) => {
      if (!tierConfig) {
        return false;
      }
      return tierConfig.features.some((featureValue) =>
        featureValue.toLowerCase().includes(feature.toLowerCase()),
      );
    },
    [tierConfig],
  );

  const hasPermission = useCallback(
    (permission: string) => {
      if (!tierConfig) {
        return false;
      }
      return tierConfig.permissions.includes(permission);
    },
    [tierConfig],
  );

  const isWithinLimit = useCallback(
    (limitKey: string, currentUsage: number) => {
      if (!tierConfig?.limits) {
        return true;
      }
      const limit = tierConfig.limits[limitKey as keyof typeof tierConfig.limits];
      if (limit === undefined || limit === -1) {
        return true;
      }
      return currentUsage <= limit;
    },
    [tierConfig],
  );

  const canUpgrade = currentTier !== "ultimate";

  const getPlanChangeType = useCallback(
    (targetTierId: string, targetBillingCadence?: "monthly" | "yearly"): PlanChangeType => {
      const tierHierarchy: Record<string, number> = {
        free: 0,
        basic: 1,
        pro: 2,
        ultimate: 3,
      };

      const currentLevel = tierHierarchy[currentTier] ?? 0;
      const targetLevel = tierHierarchy[targetTierId] ?? 0;

      if (targetLevel > currentLevel) {
        return "upgrade";
      }
      if (targetLevel < currentLevel) {
        return "downgrade";
      }
      if (
        canChangeBillingCadence &&
        billingCadence &&
        targetBillingCadence &&
        targetBillingCadence !== billingCadence
      ) {
        return "period_change";
      }
      return "same";
    },
    [currentTier, billingCadence, canChangeBillingCadence],
  );

  const value = useMemo<MembershipContextValue>(
    () => ({
      currentTier,
      tierConfig,
      isLoading,
      error,
      subscriptions,
      activeSubscription,
      hasActiveSubscription,
      orders: EMPTY_ORDERS,
      meters: EMPTY_METERS,
      benefits: EMPTY_BENEFITS,
      upgradeToTier,
      changePlan,
      openBillingPortal,
      refreshMembership,
      clearAdminTierOverride,
      hasFeature,
      hasPermission,
      isWithinLimit,
      canUpgrade,
      getPlanChangeType,
      billingCadence,
      canChangeBillingCadence,
      adminTierOverride,
      isAppAdmin,
      organizationRole,
      canManageBilling,
      isAccessLoading,
      isClearingAdminTierOverride: clearAdminTierOverrideMutation.isPending,
    }),
    [
      currentTier,
      tierConfig,
      isLoading,
      error,
      subscriptions,
      activeSubscription,
      hasActiveSubscription,
      upgradeToTier,
      changePlan,
      openBillingPortal,
      refreshMembership,
      clearAdminTierOverride,
      hasFeature,
      hasPermission,
      isWithinLimit,
      canUpgrade,
      getPlanChangeType,
      billingCadence,
      canChangeBillingCadence,
      adminTierOverride,
      isAppAdmin,
      organizationRole,
      canManageBilling,
      isAccessLoading,
      clearAdminTierOverrideMutation.isPending,
    ],
  );

  return (
    <MembershipContext.Provider value={value}>
      {children}
      {organizationPrompt ? (
        <CreateOrganizationDialog
          description={t("organizations.createDialog.billingDescription")}
          onCreated={(organization) => organizationPrompt.resolve(organization.id)}
          onOpenChange={(open) => {
            if (!open) {
              // A no-op when the organization was just created and resolved.
              organizationPrompt.resolve(null);
              setOrganizationPrompt(null);
            }
          }}
          open
        />
      ) : null}
    </MembershipContext.Provider>
  );
}
