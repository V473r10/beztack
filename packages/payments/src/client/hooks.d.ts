import type { Benefit, CheckoutSessionParams, CustomerMeter, CustomerPortalState, MembershipTier, MembershipValidationResult, Order, Subscription, UsageEvent } from "../types/index.ts";
/**
 * Auth client interface (to be provided by Better Auth)
 */
type AuthClient = {
    checkout: (params: CheckoutSessionParams) => Promise<void>;
    customer: {
        state: () => Promise<{
            data: CustomerPortalState;
        }>;
        portal: () => Promise<void>;
        subscriptions: {
            list: (options?: {
                query?: {
                    page?: number;
                    limit?: number;
                    active?: boolean;
                    referenceId?: string;
                };
            }) => Promise<{
                data: Subscription[];
            }>;
        };
        orders: {
            list: (options?: {
                query?: {
                    page?: number;
                    limit?: number;
                    productBillingType?: "one_time" | "recurring";
                };
            }) => Promise<{
                data: Order[];
            }>;
        };
        benefits: {
            list: (options?: {
                query?: {
                    page?: number;
                    limit?: number;
                };
            }) => Promise<{
                data: Benefit[];
            }>;
        };
    };
    usage: {
        ingest: (event: Omit<UsageEvent, "customerId" | "timestamp">) => Promise<{
            data: {
                id: string;
                status: string;
            };
        }>;
        meters: {
            list: (options?: {
                query?: {
                    page?: number;
                    limit?: number;
                };
            }) => Promise<{
                data: CustomerMeter[];
            }>;
        };
    };
};
/**
 * Hook for customer portal state
 */
export declare function useCustomerState(authClient: AuthClient): import("@tanstack/react-query").UseQueryResult<CustomerPortalState, Error>;
/**
 * Hook for customer subscriptions
 */
export declare function useCustomerSubscriptions(authClient: AuthClient, options?: {
    referenceId?: string;
    active?: boolean;
    limit?: number;
}): import("@tanstack/react-query").UseQueryResult<Subscription[], Error>;
/**
 * Hook for customer orders
 */
export declare function useCustomerOrders(authClient: AuthClient, options?: {
    productBillingType?: "one_time" | "recurring";
    limit?: number;
}): import("@tanstack/react-query").UseQueryResult<Order[], Error>;
/**
 * Hook for customer benefits
 */
export declare function useCustomerBenefits(authClient: AuthClient, limit?: number): import("@tanstack/react-query").UseQueryResult<Benefit[], Error>;
/**
 * Hook for customer usage meters
 */
export declare function useCustomerMeters(authClient: AuthClient, limit?: number): import("@tanstack/react-query").UseQueryResult<CustomerMeter[], Error>;
/**
 * Hook for checkout functionality
 */
export declare function useCheckout(authClient: AuthClient): {
    initiateCheckout: (params: CheckoutSessionParams) => Promise<void>;
    isLoading: boolean;
};
/**
 * Hook for billing portal access
 */
export declare function useBillingPortal(authClient: AuthClient): {
    openPortal: () => Promise<void>;
    isLoading: boolean;
};
/**
 * Hook for usage event ingestion
 */
export declare function useUsageTracking(authClient: AuthClient): import("@tanstack/react-query").UseMutationResult<{
    id: string;
    status: string;
}, Error, Omit<UsageEvent, "customerId" | "timestamp">, unknown>;
/**
 * Hook for membership tier management
 */
export declare function useMembershipTier(authClient: AuthClient, validationFn?: (state: CustomerPortalState) => MembershipValidationResult): {
    membershipInfo: MembershipValidationResult | undefined;
    data: CustomerPortalState;
    error: Error;
    isError: true;
    isPending: false;
    isLoading: false;
    isLoadingError: false;
    isRefetchError: true;
    isSuccess: false;
    isPlaceholderData: false;
    status: "error";
    dataUpdatedAt: number;
    errorUpdatedAt: number;
    failureCount: number;
    failureReason: Error | null;
    errorUpdateCount: number;
    isFetched: boolean;
    isFetchedAfterMount: boolean;
    isFetching: boolean;
    isInitialLoading: boolean;
    isPaused: boolean;
    isRefetching: boolean;
    isStale: boolean;
    isEnabled: boolean;
    refetch: (options?: import("@tanstack/react-query").RefetchOptions) => Promise<import("@tanstack/react-query").QueryObserverResult<CustomerPortalState, Error>>;
    fetchStatus: import("@tanstack/react-query").FetchStatus;
    promise: Promise<CustomerPortalState>;
} | {
    membershipInfo: MembershipValidationResult | undefined;
    data: CustomerPortalState;
    error: null;
    isError: false;
    isPending: false;
    isLoading: false;
    isLoadingError: false;
    isRefetchError: false;
    isSuccess: true;
    isPlaceholderData: false;
    status: "success";
    dataUpdatedAt: number;
    errorUpdatedAt: number;
    failureCount: number;
    failureReason: Error | null;
    errorUpdateCount: number;
    isFetched: boolean;
    isFetchedAfterMount: boolean;
    isFetching: boolean;
    isInitialLoading: boolean;
    isPaused: boolean;
    isRefetching: boolean;
    isStale: boolean;
    isEnabled: boolean;
    refetch: (options?: import("@tanstack/react-query").RefetchOptions) => Promise<import("@tanstack/react-query").QueryObserverResult<CustomerPortalState, Error>>;
    fetchStatus: import("@tanstack/react-query").FetchStatus;
    promise: Promise<CustomerPortalState>;
} | {
    membershipInfo: MembershipValidationResult | undefined;
    data: undefined;
    error: Error;
    isError: true;
    isPending: false;
    isLoading: false;
    isLoadingError: true;
    isRefetchError: false;
    isSuccess: false;
    isPlaceholderData: false;
    status: "error";
    dataUpdatedAt: number;
    errorUpdatedAt: number;
    failureCount: number;
    failureReason: Error | null;
    errorUpdateCount: number;
    isFetched: boolean;
    isFetchedAfterMount: boolean;
    isFetching: boolean;
    isInitialLoading: boolean;
    isPaused: boolean;
    isRefetching: boolean;
    isStale: boolean;
    isEnabled: boolean;
    refetch: (options?: import("@tanstack/react-query").RefetchOptions) => Promise<import("@tanstack/react-query").QueryObserverResult<CustomerPortalState, Error>>;
    fetchStatus: import("@tanstack/react-query").FetchStatus;
    promise: Promise<CustomerPortalState>;
} | {
    membershipInfo: MembershipValidationResult | undefined;
    data: undefined;
    error: null;
    isError: false;
    isPending: true;
    isLoading: true;
    isLoadingError: false;
    isRefetchError: false;
    isSuccess: false;
    isPlaceholderData: false;
    status: "pending";
    dataUpdatedAt: number;
    errorUpdatedAt: number;
    failureCount: number;
    failureReason: Error | null;
    errorUpdateCount: number;
    isFetched: boolean;
    isFetchedAfterMount: boolean;
    isFetching: boolean;
    isInitialLoading: boolean;
    isPaused: boolean;
    isRefetching: boolean;
    isStale: boolean;
    isEnabled: boolean;
    refetch: (options?: import("@tanstack/react-query").RefetchOptions) => Promise<import("@tanstack/react-query").QueryObserverResult<CustomerPortalState, Error>>;
    fetchStatus: import("@tanstack/react-query").FetchStatus;
    promise: Promise<CustomerPortalState>;
} | {
    membershipInfo: MembershipValidationResult | undefined;
    data: undefined;
    error: null;
    isError: false;
    isPending: true;
    isLoadingError: false;
    isRefetchError: false;
    isSuccess: false;
    isPlaceholderData: false;
    status: "pending";
    dataUpdatedAt: number;
    errorUpdatedAt: number;
    failureCount: number;
    failureReason: Error | null;
    errorUpdateCount: number;
    isFetched: boolean;
    isFetchedAfterMount: boolean;
    isFetching: boolean;
    isLoading: boolean;
    isInitialLoading: boolean;
    isPaused: boolean;
    isRefetching: boolean;
    isStale: boolean;
    isEnabled: boolean;
    refetch: (options?: import("@tanstack/react-query").RefetchOptions) => Promise<import("@tanstack/react-query").QueryObserverResult<CustomerPortalState, Error>>;
    fetchStatus: import("@tanstack/react-query").FetchStatus;
    promise: Promise<CustomerPortalState>;
} | {
    membershipInfo: MembershipValidationResult | undefined;
    data: CustomerPortalState;
    isError: false;
    error: null;
    isPending: false;
    isLoading: false;
    isLoadingError: false;
    isRefetchError: false;
    isSuccess: true;
    isPlaceholderData: true;
    status: "success";
    dataUpdatedAt: number;
    errorUpdatedAt: number;
    failureCount: number;
    failureReason: Error | null;
    errorUpdateCount: number;
    isFetched: boolean;
    isFetchedAfterMount: boolean;
    isFetching: boolean;
    isInitialLoading: boolean;
    isPaused: boolean;
    isRefetching: boolean;
    isStale: boolean;
    isEnabled: boolean;
    refetch: (options?: import("@tanstack/react-query").RefetchOptions) => Promise<import("@tanstack/react-query").QueryObserverResult<CustomerPortalState, Error>>;
    fetchStatus: import("@tanstack/react-query").FetchStatus;
    promise: Promise<CustomerPortalState>;
};
/**
 * Hook for subscription management
 */
export declare function useSubscriptionManagement(authClient: AuthClient, organizationId?: string): {
    subscriptions: Subscription[];
    isLoading: boolean;
    error: Error | null;
    upgradeToTier: (tier: MembershipTier) => Promise<void>;
    manageSubscription: () => Promise<void>;
    refreshSubscriptions: () => void;
};
/**
 * Hook for organization subscription checking
 */
export declare function useOrganizationSubscription(authClient: AuthClient, organizationId: string): {
    subscription: Subscription | undefined;
    tier: MembershipTier;
    hasActiveSubscription: boolean;
    isLoading: boolean;
    error: Error | null;
};
export {};
