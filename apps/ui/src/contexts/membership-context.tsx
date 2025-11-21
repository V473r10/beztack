import type { Benefit } from "@polar-sh/sdk/models/components/benefit.js";
import type { CustomerMeter } from "@polar-sh/sdk/models/components/customermeter.js";
import type { Order } from "@polar-sh/sdk/models/components/order.js";
import type { Subscription } from "@polar-sh/sdk/models/components/subscription.js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { createContext, useCallback, useContext } from "react";
// import { authClient } from "@/lib/auth-client"; // TODO: Re-enable when server-side Polar integration is complete
import { toast } from "sonner";
import { env } from "@/env";
import type { MembershipTier, MembershipTierConfig } from "@/types/membership";

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
  openBillingPortal: (returnUrl?: string) => Promise<void>;
  refreshMembership: () => void;

  // Utility functions
  hasFeature: (feature: string) => boolean;
  hasPermission: (permission: string) => boolean;
  isWithinLimit: (limitKey: string, currentUsage: number) => boolean;
  canUpgrade: boolean;
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

  // Mock data queries for now until server-side Polar integration is complete
  const customerStateQuery = useQuery({
    queryKey: ["customer", "state"],
    queryFn: () => {
      // Mock customer state
      return {
        customerId: "mock-customer",
        subscriptions: [],
        orders: [],
        benefits: [],
        meters: [],
      };
    },
    staleTime: CUSTOMER_STATE_STALE_TIME,
  });

  // Fetch subscriptions
  const subscriptionsQuery = useQuery({
    queryKey: ["customer", "subscriptions"],
    queryFn: (): Promise<Subscription[]> => {
      // Mock subscriptions - replace with actual API call when server is ready
      return Promise.resolve([]);
    },
    staleTime: SUBSCRIPTIONS_STALE_TIME,
  });

  // Fetch orders
  const ordersQuery = useQuery({
    queryKey: ["customer", "orders"],
    queryFn: (): Promise<Order[]> => {
      // Mock orders - replace with actual API call when server is ready
      return Promise.resolve([]);
    },
    staleTime: ORDERS_STALE_TIME,
  });

  // Fetch meters
  const metersQuery = useQuery({
    queryKey: ["customer", "meters"],
    queryFn: (): Promise<CustomerMeter[]> => {
      // Mock meters - replace with actual API call when server is ready
      return Promise.resolve([]);
    },
    staleTime: SUBSCRIPTIONS_STALE_TIME, // 2 minutes
  });

  // Fetch benefits
  const benefitsQuery = useQuery({
    queryKey: ["customer", "benefits"],
    queryFn: (): Promise<Benefit[]> => {
      // Mock benefits - replace with actual API call when server is ready
      return Promise.resolve([]);
    },
    staleTime: CUSTOMER_STATE_STALE_TIME, // 5 minutes
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

  // Billing portal mutation
  const billingPortalMutation = useMutation({
    mutationFn: () => {
      toast.success(
        "Mock billing portal opened (replace with actual implementation)"
      );
      return Promise.resolve();
    },
    onSuccess: () => {
      toast.success("Opening billing portal...");
    },
    onError: () => {
      toast.error("Failed to open billing portal");
    },
  });

  // Derived state
  const subscriptions = subscriptionsQuery.data || [];
  const orders = ordersQuery.data || [];
  const meters = metersQuery.data || [];
  const benefits = benefitsQuery.data || [];

  const activeSubscription =
    subscriptions.find(
      (sub: Subscription) =>
        sub?.status === "active" ||
        (sub?.status === "canceled" &&
          sub?.currentPeriodEnd &&
          new Date(sub.currentPeriodEnd) > new Date())
    ) || null;

  // Determine current tier from subscription or default to free
  const currentTier: MembershipTier =
    (activeSubscription?.metadata?.tier as MembershipTier) || "free";

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
    billingPortalMutation.isPending;

  const error =
    customerStateQuery.error ||
    subscriptionsQuery.error ||
    ordersQuery.error ||
    metersQuery.error ||
    benefitsQuery.error;

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
    openBillingPortal,
    refreshMembership,

    hasFeature,
    hasPermission,
    isWithinLimit,
    canUpgrade,
  };

  return (
    <MembershipContext.Provider value={value}>
      {children}
    </MembershipContext.Provider>
  );
}
