import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import type {
  MembershipTier,
  MembershipValidationResult,
  CustomerPortalState,
  Subscription,
  Order,
  Benefit,
  CustomerMeter,
  CheckoutSessionParams,
  UsageEvent,
} from "../types/index.ts";

/**
 * Auth client interface (to be provided by Better Auth)
 */
interface AuthClient {
  checkout: (params: CheckoutSessionParams) => Promise<void>;
  customer: {
    state: () => Promise<{ data: CustomerPortalState }>;
    portal: () => Promise<void>;
    subscriptions: {
      list: (options?: {
        query?: {
          page?: number;
          limit?: number;
          active?: boolean;
          referenceId?: string;
        };
      }) => Promise<{ data: Subscription[] }>;
    };
    orders: {
      list: (options?: {
        query?: {
          page?: number;
          limit?: number;
          productBillingType?: "one_time" | "recurring";
        };
      }) => Promise<{ data: Order[] }>;
    };
    benefits: {
      list: (options?: {
        query?: {
          page?: number;
          limit?: number;
        };
      }) => Promise<{ data: Benefit[] }>;
    };
  };
  usage: {
    ingest: (event: Omit<UsageEvent, "customerId" | "timestamp">) => Promise<{ data: any }>;
    meters: {
      list: (options?: {
        query?: {
          page?: number;
          limit?: number;
        };
      }) => Promise<{ data: CustomerMeter[] }>;
    };
  };
}

/**
 * Hook for customer portal state
 */
export function useCustomerState(authClient: AuthClient) {
  return useQuery({
    queryKey: ["customer", "state"],
    queryFn: async () => {
      const { data } = await authClient.customer.state();
      return data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook for customer subscriptions
 */
export function useCustomerSubscriptions(
  authClient: AuthClient,
  options?: {
    referenceId?: string;
    active?: boolean;
    limit?: number;
  }
) {
  return useQuery({
    queryKey: ["customer", "subscriptions", options],
    queryFn: async () => {
      const { data } = await authClient.customer.subscriptions.list({
        query: {
          active: options?.active,
          referenceId: options?.referenceId,
          limit: options?.limit ?? 10,
          page: 1,
        },
      });
      return data;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Hook for customer orders
 */
export function useCustomerOrders(
  authClient: AuthClient,
  options?: {
    productBillingType?: "one_time" | "recurring";
    limit?: number;
  }
) {
  return useQuery({
    queryKey: ["customer", "orders", options],
    queryFn: async () => {
      const { data } = await authClient.customer.orders.list({
        query: {
          productBillingType: options?.productBillingType,
          limit: options?.limit ?? 10,
          page: 1,
        },
      });
      return data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook for customer benefits
 */
export function useCustomerBenefits(authClient: AuthClient, limit?: number) {
  return useQuery({
    queryKey: ["customer", "benefits", limit],
    queryFn: async () => {
      const { data } = await authClient.customer.benefits.list({
        query: {
          limit: limit ?? 10,
          page: 1,
        },
      });
      return data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook for customer usage meters
 */
export function useCustomerMeters(authClient: AuthClient, limit?: number) {
  return useQuery({
    queryKey: ["customer", "meters", limit],
    queryFn: async () => {
      const { data } = await authClient.usage.meters.list({
        query: {
          limit: limit ?? 10,
          page: 1,
        },
      });
      return data;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Hook for checkout functionality
 */
export function useCheckout(authClient: AuthClient) {
  const [isLoading, setIsLoading] = useState(false);

  const initiateCheckout = useCallback(
    async (params: CheckoutSessionParams) => {
      setIsLoading(true);
      try {
        await authClient.checkout(params);
      } finally {
        setIsLoading(false);
      }
    },
    [authClient]
  );

  return {
    initiateCheckout,
    isLoading,
  };
}

/**
 * Hook for billing portal access
 */
export function useBillingPortal(authClient: AuthClient) {
  const [isLoading, setIsLoading] = useState(false);

  const openPortal = useCallback(async () => {
    setIsLoading(true);
    try {
      await authClient.customer.portal();
    } finally {
      setIsLoading(false);
    }
  }, [authClient]);

  return {
    openPortal,
    isLoading,
  };
}

/**
 * Hook for usage event ingestion
 */
export function useUsageTracking(authClient: AuthClient) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (event: Omit<UsageEvent, "customerId" | "timestamp">) => {
      const { data } = await authClient.usage.ingest(event);
      return data;
    },
    onSuccess: () => {
      // Invalidate meters query to refresh usage data
      queryClient.invalidateQueries({ queryKey: ["customer", "meters"] });
    },
  });
}

/**
 * Hook for membership tier management
 */
export function useMembershipTier(
  authClient: AuthClient,
  validationFn?: (state: CustomerPortalState) => MembershipValidationResult
) {
  const customerStateQuery = useCustomerState(authClient);

  const membershipInfo = customerStateQuery.data
    ? validationFn?.(customerStateQuery.data) ?? {
        isValid: true,
        tier: "free" as MembershipTier,
        permissions: [],
        limits: {},
        features: [],
      }
    : undefined;

  return {
    ...customerStateQuery,
    membershipInfo,
  };
}

/**
 * Hook for subscription management
 */
export function useSubscriptionManagement(
  authClient: AuthClient,
  organizationId?: string
) {
  const queryClient = useQueryClient();
  const checkout = useCheckout(authClient);
  const portal = useBillingPortal(authClient);

  const subscriptions = useCustomerSubscriptions(authClient, {
    referenceId: organizationId,
    active: true,
  });

  const upgradeToTier = useCallback(
    async (tier: MembershipTier) => {
      await checkout.initiateCheckout({
        slug: tier,
        metadata: {
          organizationId,
          tier,
        },
      });
    },
    [checkout, organizationId]
  );

  const manageSubscription = useCallback(async () => {
    await portal.openPortal();
  }, [portal]);

  const refreshSubscriptions = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["customer", "subscriptions"] });
    queryClient.invalidateQueries({ queryKey: ["customer", "state"] });
  }, [queryClient]);

  return {
    subscriptions: subscriptions.data ?? [],
    isLoading: subscriptions.isLoading || checkout.isLoading || portal.isLoading,
    error: subscriptions.error,
    upgradeToTier,
    manageSubscription,
    refreshSubscriptions,
  };
}

/**
 * Hook for organization subscription checking
 */
export function useOrganizationSubscription(
  authClient: AuthClient,
  organizationId: string
) {
  const subscriptions = useCustomerSubscriptions(authClient, {
    referenceId: organizationId,
    active: true,
  });

  const activeSubscription = subscriptions.data?.find((sub: Subscription) => 
    sub.metadata.organizationId === organizationId &&
    sub.status === "active"
  );

  const tier = activeSubscription?.metadata?.tier as MembershipTier ?? "free";

  return {
    subscription: activeSubscription,
    tier,
    hasActiveSubscription: !!activeSubscription,
    isLoading: subscriptions.isLoading,
    error: subscriptions.error,
  };
}