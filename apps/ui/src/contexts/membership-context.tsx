/** biome-ignore-all lint/suspicious/useAwait: <explanation> */
import type { Benefit } from "@polar-sh/sdk/models/components/benefit.js";
import type { CustomerMeter } from "@polar-sh/sdk/models/components/customermeter.js";
import type { Order } from "@polar-sh/sdk/models/components/order.js";
import type { Subscription } from "@polar-sh/sdk/models/components/subscription.js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { createContext, useCallback, useContext } from "react";
import { toast } from "sonner";
import { env } from "@/env";
import { authClient } from "@/lib/auth-client";
import type { MembershipTier, MembershipTierConfig } from "@/types/membership";

// Type for Polar API response structure
type PolarListResponse = {
  items?: unknown[];
  result?: { items?: unknown[] };
};

// Time constants
const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const FIVE_MINUTES = 5;
const TWO_MINUTES = 2;

// Query stale time constants
const CUSTOMER_STATE_STALE_TIME =
  MILLISECONDS_PER_SECOND * SECONDS_PER_MINUTE * FIVE_MINUTES; // 5 minutes
const SUBSCRIPTIONS_STALE_TIME =
  MILLISECONDS_PER_SECOND * SECONDS_PER_MINUTE * TWO_MINUTES; // 2 minutes
const ORDERS_STALE_TIME =
  MILLISECONDS_PER_SECOND * SECONDS_PER_MINUTE * FIVE_MINUTES; // 5 minutes

// Plan change type for detecting upgrade vs downgrade
export type PlanChangeType = "upgrade" | "downgrade" | "same" | "period_change";

// Plan change result from API
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
  // Current membership state
  currentTier: MembershipTier;
  tierConfig: MembershipTierConfig | null;
  isLoading: boolean;
  error: Error | null;

  // Subscription data
  subscriptions: Subscription[];
  activeSubscription: Subscription | null;
  orders: Order[];
  meters: CustomerMeter[];
  benefits: Benefit[];

  // Actions
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
  refreshMembership: () => void;

  // Utility functions
  hasFeature: (feature: string) => boolean;
  hasPermission: (permission: string) => boolean;
  isWithinLimit: (limitKey: string, currentUsage: number) => boolean;
  canUpgrade: boolean;
  getPlanChangeType: (targetTierId: string) => PlanChangeType;
};

const MembershipContext = createContext<MembershipContextValue | null>(null);

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

  // Fetch customer state directly from Polar via Better Auth plugin
  // This is the source of truth for subscription data
  const customerStateQuery = useQuery({
    queryKey: ["customer", "state"],
    queryFn: async () => {
      const result = await authClient.customer.state();
      if (result.error) {
        throw new Error(
          result.error.message || "Failed to fetch customer state"
        );
      }
      return result.data;
    },
    staleTime: CUSTOMER_STATE_STALE_TIME,
  });

  // Fetch subscriptions from Polar
  const subscriptionsQuery = useQuery({
    queryKey: ["customer", "subscriptions"],
    queryFn: async (): Promise<Subscription[]> => {
      const result = await authClient.customer.subscriptions.list({
        query: { limit: 100, active: true },
      });
      if (result.error) {
        return [];
      }
      // Handle different response structures from Polar API
      const data = result.data as PolarListResponse | undefined;
      const items = (data?.items ||
        data?.result?.items ||
        []) as Subscription[];
      return items;
    },
    staleTime: SUBSCRIPTIONS_STALE_TIME,
  });

  // Fetch orders from Polar
  const ordersQuery = useQuery({
    queryKey: ["customer", "orders"],
    queryFn: async (): Promise<Order[]> => {
      const result = await authClient.customer.orders.list({
        query: { limit: 100 },
      });
      if (result.error) {
        return [];
      }
      // Handle different response structures from Polar API
      const data = result.data as PolarListResponse | undefined;
      const items = (data?.items || data?.result?.items || []) as Order[];
      return items;
    },
    staleTime: ORDERS_STALE_TIME,
  });

  // Checkout mutation
  const checkoutMutation = useMutation({
    mutationFn: async (params: {
      productId: string;
      billingPeriod: "monthly" | "yearly";
      metadata?: Record<string, unknown>;
    }) => {
      const response = await fetch(`${env.VITE_API_URL}/api/polar/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId: params.productId,
          successUrl: `${window.location.origin}/dashboard?checkout=success`,
          cancelUrl: `${window.location.origin}/pricing?checkout=canceled`,
          metadata: {
            billingPeriod: params.billingPeriod,
            ...params.metadata,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Checkout failed: ${response.statusText}`);
      }

      const data = await response.json();

      // Redirect to Polar checkout
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

  // Plan change mutation (for existing subscriptions)
  const planChangeMutation = useMutation({
    mutationFn: async (params: {
      subscriptionId: string;
      productId: string;
      prorationBehavior: "invoice" | "prorate";
    }): Promise<PlanChangeResult> => {
      const response = await fetch(
        `${env.VITE_API_URL}/api/polar/subscription`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            subscriptionId: params.subscriptionId,
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

      return response.json();
    },
    onSuccess: () => {
      toast.success("Plan updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["customer"] });
    },
    // biome-ignore lint/nursery/noShadow: <explanation>
    onError: (error: Error) => {
      toast.error(error.message || "Failed to change plan");
    },
  });

  // Billing portal mutation
  const billingPortalMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      // Open Polar customer portal
      const result = await authClient.customer.portal();
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
    onError: () => {
      toast.error("Failed to open billing portal");
    },
  });

  // Derived state from Polar customer state (source of truth)
  // Use type assertion for flexible access to Polar response structure
  const customerState = customerStateQuery.data as
    | Record<string, unknown>
    | undefined;
  const subscriptions =
    (customerState?.subscriptions as Subscription[]) ||
    subscriptionsQuery.data ||
    [];
  const orders = ordersQuery.data || [];
  const meters = (customerState?.meters as CustomerMeter[]) || [];
  const benefits = (customerState?.benefits as Benefit[]) || [];

  const activeSubscription =
    subscriptions.find(
      (sub: Subscription) =>
        sub?.status === "active" ||
        (sub?.status === "canceled" &&
          sub?.currentPeriodEnd &&
          new Date(sub.currentPeriodEnd) > new Date())
    ) || null;

  // Determine current tier from active subscription product name
  const determineTier = (): MembershipTier => {
    if (!activeSubscription) {
      return "free";
    }
    const productName = activeSubscription.product?.name?.toLowerCase() || "";
    if (productName.includes("ultimate")) {
      return "ultimate";
    }
    if (productName.includes("pro")) {
      return "pro";
    }
    if (productName.includes("basic")) {
      return "basic";
    }
    return "free";
  };

  const currentTier: MembershipTier = determineTier();

  // Fetch tier configurations from API instead of hardcoded constants
  const tierConfigsQuery = useQuery({
    queryKey: ["tierConfigs"],
    queryFn: async (): Promise<MembershipTierConfig[]> => {
      const response = await fetch(`${env.VITE_API_URL}/api/polar/products`);
      if (!response.ok) {
        throw new Error("Failed to fetch tier configurations");
      }
      const data = await response.json();
      return data as MembershipTierConfig[];
    },
    staleTime: CUSTOMER_STATE_STALE_TIME, // Cache for 5 minutes
  });

  const tierConfig =
    tierConfigsQuery.data?.find(
      (config: MembershipTierConfig) => config.id === currentTier
    ) || null;

  const isLoading =
    customerStateQuery.isLoading ||
    subscriptionsQuery.isLoading ||
    checkoutMutation.isPending ||
    planChangeMutation.isPending ||
    billingPortalMutation.isPending;

  const error =
    customerStateQuery.error || subscriptionsQuery.error || ordersQuery.error;

  // Actions
  const upgradeToTier = useCallback(
    async (
      tierId: string,
      billingPeriod: "monthly" | "yearly" = "monthly",
      organizationId?: string
    ) => {
      await checkoutMutation.mutateAsync({
        productId: tierId,
        billingPeriod,
        metadata: {
          tier: tierId as MembershipTier,
          organizationId,
        },
      });
    },
    [checkoutMutation]
  );

  // Change plan for existing subscription
  const changePlan = useCallback(
    async (
      productId: string,
      options?: {
        prorationBehavior?: "invoice" | "prorate";
      }
    ): Promise<PlanChangeResult> => {
      if (!activeSubscription) {
        throw new Error("No active subscription to change");
      }

      return planChangeMutation.mutateAsync({
        subscriptionId: activeSubscription.id,
        productId,
        prorationBehavior: options?.prorationBehavior || "prorate",
      });
    },
    [activeSubscription, planChangeMutation]
  );

  const openBillingPortal = useCallback(async () => {
    await billingPortalMutation.mutateAsync();
  }, [billingPortalMutation]);

  const refreshMembership = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["customer"] });
  }, [queryClient]);

  // Utility functions
  const hasFeature = useCallback(
    (feature: string) => {
      if (!tierConfig) {
        return false;
      }
      return tierConfig.features.some((f) =>
        f.toLowerCase().includes(feature.toLowerCase())
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
      if (limit === undefined) {
        return true;
      }
      if (limit === -1) {
        return true; // Unlimited
      }
      return currentUsage <= limit;
    },
    [tierConfig]
  );

  const canUpgrade = currentTier !== "ultimate";

  // Determine if target tier is upgrade, downgrade, or same
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

  const value: MembershipContextValue = {
    currentTier,
    tierConfig,
    isLoading,
    error: error as Error | null,

    subscriptions,
    activeSubscription,
    orders,
    meters,
    benefits,

    upgradeToTier,
    changePlan,
    openBillingPortal,
    refreshMembership,

    hasFeature,
    hasPermission,
    isWithinLimit,
    canUpgrade,
    getPlanChangeType,
  };

  return (
    <MembershipContext.Provider value={value}>
      {children}
    </MembershipContext.Provider>
  );
}
