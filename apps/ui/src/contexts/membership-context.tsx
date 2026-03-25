import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { createContext, useCallback, useContext, useMemo, useRef } from "react";
import { toast } from "sonner";
import { env } from "@/env";
import { authClient } from "@/lib/auth-client";
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

const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const FIVE_MINUTES = 5;
const TWO_MINUTES = 2;

const CUSTOMER_STATE_STALE_TIME =
  MILLISECONDS_PER_SECOND * SECONDS_PER_MINUTE * FIVE_MINUTES;
const SUBSCRIPTIONS_STALE_TIME =
  MILLISECONDS_PER_SECOND * SECONDS_PER_MINUTE * TWO_MINUTES;

const EMPTY_PRODUCTS: Product[] = [];
const EMPTY_SUBSCRIPTIONS: Subscription[] = [];
const EMPTY_ORDERS: Order[] = [];
const EMPTY_METERS: CustomerMeter[] = [];
const EMPTY_BENEFITS: string[] = [];

export type {
  CustomerMeter,
  Order,
  Subscription,
} from "./membership/membership-types";

export type PlanChangeType = "upgrade" | "downgrade" | "same" | "period_change";

export type PlanChangeResult = {
  success: boolean;
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
  orders: Order[];
  meters: CustomerMeter[];
  benefits: string[];
  upgradeToTier: (
    tierId: string,
    billingPeriod?: "monthly" | "yearly",
    organizationId?: string
  ) => Promise<void>;
  changePlan: (
    productId: string,
    options?: {
      prorationBehavior?: "invoice" | "prorate";
    }
  ) => Promise<PlanChangeResult>;
  openBillingPortal: (returnUrl?: string) => Promise<void>;
  refreshMembership: () => Promise<void>;
  hasFeature: (feature: string) => boolean;
  hasPermission: (permission: string) => boolean;
  isWithinLimit: (limitKey: string, currentUsage: number) => boolean;
  canUpgrade: boolean;
  getPlanChangeType: (targetTierId: string) => PlanChangeType;
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
  provider: "polar" | "mercadopago"
): MembershipTierConfig[] {
  return buildTierConfigs(products, plans, provider);
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
  const queryClient = useQueryClient();

  const productsQuery = useQuery({
    queryKey: ["subscriptions", "products"],
    queryFn: async (): Promise<ProductsResponse> => {
      const response = await fetch(
        `${env.VITE_API_URL}/api/subscriptions/products`,
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch subscription products");
      }

      return response.json();
    },
    staleTime: CUSTOMER_STATE_STALE_TIME,
  });

  const subscriptionsQuery = useQuery({
    queryKey: ["subscriptions", "list"],
    queryFn: async (): Promise<SubscriptionsResponse> => {
      const response = await fetch(`${env.VITE_API_URL}/api/subscriptions`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch subscriptions");
      }

      return response.json();
    },
    staleTime: SUBSCRIPTIONS_STALE_TIME,
  });

  const checkoutMutation = useMutation({
    mutationFn: async (params: {
      productId: string;
      billingPeriod: "monthly" | "yearly";
      metadata?: Record<string, unknown>;
      upgrade?: boolean;
    }) => {
      const selectedProduct = productsQuery.data?.products.find(
        (product) => product.id === params.productId
      );
      const selectedPlanId = selectedProduct
        ? parseTierIdFromProduct(selectedProduct)
        : "free";

      const response = await fetch(
        `${env.VITE_API_URL}/api/subscriptions/checkout`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            productId: params.productId,
            planId: selectedPlanId !== "free" ? selectedPlanId : undefined,
            billingPeriod: params.billingPeriod,
            successUrl: `${window.location.origin}/checkout-success`,
            cancelUrl: `${window.location.origin}/pricing?checkout=canceled`,
            upgrade: params.upgrade,
            metadata: {
              billingPeriod: params.billingPeriod,
              ...params.metadata,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Checkout failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }

      return data;
    },
    onSuccess: () => {
      toast.success("Redirecting to checkout...");
    },
    onError: () => {
      toast.error("Failed to start checkout process");
    },
  });

  const planChangeMutation = useMutation({
    mutationFn: async (params: {
      subscriptionId: string;
      productId: string;
      prorationBehavior: "invoice" | "prorate";
    }): Promise<PlanChangeResult> => {
      const response = await fetch(
        `${env.VITE_API_URL}/api/subscriptions/${params.subscriptionId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            productId: params.productId,
            prorationBehavior: params.prorationBehavior,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.statusMessage ||
            `Plan change failed: ${response.statusText}`
        );
      }

      const payload = await response.json();
      const subscription = payload.subscription as Subscription;

      return {
        success: true,
        subscription: {
          id: subscription.id,
          status: subscription.status,
          productId: subscription.productId,
          amount: 0,
          currency: "USD",
          currentPeriodEnd: subscription.currentPeriodEnd
            ? new Date(subscription.currentPeriodEnd).toISOString()
            : new Date().toISOString(),
          recurringInterval: "month",
        },
      };
    },
    onSuccess: () => {
      toast.success("Plan updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
    },
    onError: (mutationError: Error) => {
      toast.error(mutationError.message || "Failed to change plan");
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
        throw new Error(
          result.error.message || "Failed to open billing portal"
        );
      }
      if (result.data?.url) {
        window.open(result.data.url, "_blank");
      }
    },
    onSuccess: () => {
      toast.success("Opening billing portal...");
    },
    onError: (billingPortalError: Error) => {
      toast.error(
        billingPortalError.message || "Failed to open billing portal"
      );
    },
  });

  const products = productsQuery.data?.products ?? EMPTY_PRODUCTS;
  const subscriptions =
    subscriptionsQuery.data?.subscriptions ?? EMPTY_SUBSCRIPTIONS;

  const activeSubscription = (() => {
    const isValidSub = (sub: Subscription) =>
      sub.status === "active" ||
      (sub.status === "canceled" &&
        sub.currentPeriodEnd !== undefined &&
        new Date(sub.currentPeriodEnd) > new Date());

    const validSubs = subscriptions.filter(isValidSub);

    // When a downgrade is pending, prefer the original (non-downgrade)
    // subscription so the UI shows the current tier until it expires.
    if (validSubs.length > 1) {
      const nonDowngrade = validSubs.find(
        (sub) => sub.metadata?.proratedDowngrade !== true
      );
      if (nonDowngrade) {
        return nonDowngrade;
      }
    }

    return validSubs.at(0) ?? null;
  })();

  // TODO: Mercado Pago no tiene metadata, no estamos obteniendo ningún tier, esto hay que sacarlo de la base.

  const currentTier = parseTierIdFromName(
    (activeSubscription?.metadata?.tier as string | undefined) ||
      (activeSubscription?.metadata?.planId as string | undefined) ||
      activeSubscription?.productName
  );

  const dbPlans = productsQuery.data?.plans;

  const provider = productsQuery.data?.provider ?? "polar";
  const tierConfigs = useMemo(
    () => buildTierConfigFromPlansAndProducts(products, dbPlans, provider),
    [products, dbPlans, provider]
  );

  const tierConfig =
    tierConfigs.find((config) => config.id === currentTier) || null;

  const isLoading =
    productsQuery.isLoading ||
    subscriptionsQuery.isLoading ||
    checkoutMutation.isPending ||
    planChangeMutation.isPending ||
    billingPortalMutation.isPending;

  const error =
    (productsQuery.error as Error | null) ||
    (subscriptionsQuery.error as Error | null);

  const checkoutRef = useRef(checkoutMutation.mutateAsync);
  checkoutRef.current = checkoutMutation.mutateAsync;

  const upgradeToTier = useCallback(
    async (
      tierId: string,
      billingPeriod: "monthly" | "yearly" = "monthly",
      organizationId?: string
    ) => {
      await checkoutRef.current({
        productId: tierId,
        billingPeriod,
        upgrade: !!activeSubscription,
        metadata: {
          organizationId,
        },
      });
    },
    [activeSubscription]
  );

  const planChangeRef = useRef(planChangeMutation.mutateAsync);
  planChangeRef.current = planChangeMutation.mutateAsync;

  const activeSubIdRef = useRef(activeSubscription?.id);
  activeSubIdRef.current = activeSubscription?.id;

  const changePlan = useCallback(
    (
      productId: string,
      options?: {
        prorationBehavior?: "invoice" | "prorate";
      }
    ): Promise<PlanChangeResult> => {
      if (!activeSubIdRef.current) {
        throw new Error("No active subscription to change");
      }

      return planChangeRef.current({
        subscriptionId: activeSubIdRef.current,
        productId,
        prorationBehavior: options?.prorationBehavior || "prorate",
      });
    },
    []
  );

  const billingPortalRef = useRef(billingPortalMutation.mutateAsync);
  billingPortalRef.current = billingPortalMutation.mutateAsync;

  const openBillingPortal = useCallback(async () => {
    await billingPortalRef.current();
  }, []);

  const refreshMembership = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
  }, [queryClient]);

  const hasFeature = useCallback(
    (feature: string) => {
      if (!tierConfig) {
        return false;
      }
      return tierConfig.features.some((featureValue) =>
        featureValue.toLowerCase().includes(feature.toLowerCase())
      );
    },
    [tierConfig]
  );

  const hasPermission = useCallback(
    (permission: string) => {
      if (!tierConfig) {
        return false;
      }
      return tierConfig.permissions.includes(permission);
    },
    [tierConfig]
  );

  const isWithinLimit = useCallback(
    (limitKey: string, currentUsage: number) => {
      if (!tierConfig?.limits) {
        return true;
      }
      const limit =
        tierConfig.limits[limitKey as keyof typeof tierConfig.limits];
      if (limit === undefined || limit === -1) {
        return true;
      }
      return currentUsage <= limit;
    },
    [tierConfig]
  );

  const canUpgrade = currentTier !== "ultimate";

  const getPlanChangeType = useCallback(
    (targetTierId: string): PlanChangeType => {
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
      return "same";
    },
    [currentTier]
  );

  const value = useMemo<MembershipContextValue>(
    () => ({
      currentTier,
      tierConfig,
      isLoading,
      error,
      subscriptions,
      activeSubscription,
      orders: EMPTY_ORDERS,
      meters: EMPTY_METERS,
      benefits: EMPTY_BENEFITS,
      upgradeToTier,
      changePlan,
      openBillingPortal,
      refreshMembership,
      hasFeature,
      hasPermission,
      isWithinLimit,
      canUpgrade,
      getPlanChangeType,
    }),
    [
      currentTier,
      tierConfig,
      isLoading,
      error,
      subscriptions,
      activeSubscription,
      upgradeToTier,
      changePlan,
      openBillingPortal,
      refreshMembership,
      hasFeature,
      hasPermission,
      isWithinLimit,
      canUpgrade,
      getPlanChangeType,
    ]
  );

  return (
    <MembershipContext.Provider value={value}>
      {children}
    </MembershipContext.Provider>
  );
}
