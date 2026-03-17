import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { createContext, useCallback, useContext, useMemo } from "react";
import { toast } from "sonner";
import { env } from "@/env";
import { authClient } from "@/lib/auth-client";
import type { MembershipTier, MembershipTierConfig } from "@/types/membership";

const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const FIVE_MINUTES = 5;
const TWO_MINUTES = 2;

const MONTHS_PER_YEAR = 12;

const CUSTOMER_STATE_STALE_TIME =
  MILLISECONDS_PER_SECOND * SECONDS_PER_MINUTE * FIVE_MINUTES;
const SUBSCRIPTIONS_STALE_TIME =
  MILLISECONDS_PER_SECOND * SECONDS_PER_MINUTE * TWO_MINUTES;

type DeepMutable<T> = {
  -readonly [P in keyof T]: T[P] extends object ? DeepMutable<T[P]> : T[P];
};
type MutableTierConfig = DeepMutable<MembershipTierConfig>;

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

type Product = {
  id: string;
  name: string;
  description?: string;
  price: {
    amount: number;
    currency: string;
  };
  interval: "month" | "year" | "day" | "week";
  intervalCount: number;
  metadata?: Record<string, unknown>;
};

export type Subscription = {
  id: string;
  status:
    | "active"
    | "inactive"
    | "pending"
    | "canceled"
    | "paused"
    | "past_due";
  productId: string;
  productName?: string;
  customerId?: string;
  customerEmail?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  metadata?: Record<string, unknown>;
  createdAt?: string | Date;
};

export type Order = {
  id: string;
  status: string;
  totalAmount: number;
  metadata?: Record<string, unknown>;
  createdAt?: string | Date;
};

export type CustomerMeter = {
  id: string;
  name: string;
  value: number;
  limit?: number;
};

type CatalogPlan = {
  id: string;
  canonicalTierId: MembershipTier | null;
  displayName: string;
  description: string | null;
  features: string[];
  limits: Record<string, number>;
  permissions: string[];
  price: { amount: number; currency: string };
  frequency: number;
  frequencyType: string;
  initPoint: string | null;
  highlighted: boolean;
  visible: boolean;
  displayOrder: number | null;
};

type ProductsResponse = {
  provider: "polar" | "mercadopago";
  products: Product[];
  plans?: CatalogPlan[];
};

type SubscriptionsResponse = {
  provider: "polar" | "mercadopago";
  subscriptions: Subscription[];
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
  refreshMembership: () => void;
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
  const name = raw?.toLowerCase() ?? "";

  if (name.includes("ultimate") || name.includes("enterprise")) {
    return "ultimate";
  }
  if (name.includes("pro")) {
    return "pro";
  }
  if (name.includes("basic")) {
    return "basic";
  }

  return "free";
}

function parseTierIdFromMetadata(
  metadata: Record<string, unknown> | undefined
): MembershipTier {
  const planId =
    typeof metadata?.planId === "string" ? metadata.planId : undefined;
  if (planId) {
    return parseTierIdFromName(planId);
  }

  const tier = typeof metadata?.tier === "string" ? metadata.tier : undefined;
  if (tier) {
    return parseTierIdFromName(tier);
  }

  return "free";
}

function parseTierIdFromProduct(product: Product): MembershipTier {
  const metadataTier = parseTierIdFromMetadata(product.metadata);
  if (metadataTier !== "free") {
    return metadataTier;
  }

  return parseTierIdFromName(product.name);
}

const CENTS_DIVISOR = 100;

/**
 * Convert a provider-native amount to display units.
 * Polar returns cents (900 → 9), MercadoPago returns whole currency (4500 → 4500).
 */
function toDisplayAmount(
  amount: number,
  provider: "polar" | "mercadopago"
): number {
  if (provider === "polar") {
    return amount / CENTS_DIVISOR;
  }
  return amount;
}

function buildTierConfigFromPlansAndProducts(
  products: Product[],
  plans: CatalogPlan[] | undefined,
  provider: "polar" | "mercadopago"
): MembershipTierConfig[] {
  const tiers: Record<MembershipTier, MutableTierConfig> = {
    free: {
      id: "free",
      name: "Free",
      description: "Free plan",
      price: { monthly: 0, yearly: 0 },
      features: [],
      limits: {},
      permissions: [],
    },
    basic: {
      id: "basic",
      name: "Basic",
      description: "Basic plan",
      price: { monthly: 0, yearly: 0 },
      features: [],
      limits: {},
      permissions: [],
    },
    pro: {
      id: "pro",
      name: "Pro",
      description: "Pro plan",
      price: { monthly: 0, yearly: 0 },
      features: [],
      limits: {},
      permissions: [],
    },
    ultimate: {
      id: "ultimate",
      name: "Ultimate",
      description: "Ultimate plan",
      price: { monthly: 0, yearly: 0 },
      features: [],
      limits: {},
      permissions: [],
    },
  };

  // Populate from DB catalog plans first (authoritative source)
  if (plans && plans.length > 0) {
    for (const plan of plans) {
      const tierId = plan.canonicalTierId;
      if (!tierId) {
        continue;
      }
      const current = tiers[tierId];
      current.name = plan.displayName;
      if (plan.description) {
        current.description = plan.description;
      }
      if (plan.features.length > 0) {
        current.features = plan.features;
      }
      if (Object.keys(plan.limits).length > 0) {
        current.limits = plan.limits;
      }
      if (plan.permissions.length > 0) {
        current.permissions = plan.permissions;
      }

      // Map frequency to billing period
      const isYearly =
        plan.frequencyType === "years" ||
        (plan.frequencyType === "months" && plan.frequency === MONTHS_PER_YEAR);
      const displayPrice = toDisplayAmount(plan.price.amount, provider);
      if (isYearly) {
        current.price.yearly = displayPrice;
        current.yearly = {
          id: plan.id,
          name: plan.displayName,
          description: plan.description ?? undefined,
          price: plan.price.amount,
          currency: plan.price.currency,
          billing_period: "yearly",
        };
      } else {
        current.price.monthly = displayPrice;
        current.monthly = {
          id: plan.id,
          name: plan.displayName,
          description: plan.description ?? undefined,
          price: plan.price.amount,
          currency: plan.price.currency,
          billing_period: "monthly",
        };
      }
    }
  }

  // Supplement with provider product data (fills gaps)
  for (const product of products) {
    const tierId = parseTierIdFromProduct(product);
    const current = tiers[tierId];

    if (current.features.length === 0) {
      current.name = product.name.split(" - ")[0] || current.name;
      if (product.description) {
        current.description = product.description;
      }
    }

    if (product.interval === "month" && !current.monthly) {
      current.price.monthly = toDisplayAmount(product.price.amount, provider);
      current.monthly = {
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price.amount,
        currency: product.price.currency,
        billing_period: "monthly",
      };
    }

    if (product.interval === "year" && !current.yearly) {
      current.price.yearly = toDisplayAmount(product.price.amount, provider);
      current.yearly = {
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price.amount,
        currency: product.price.currency,
        billing_period: "yearly",
      };
    }

    // Only use product metadata as fallback for features/limits/permissions
    if (current.features.length === 0) {
      const metadata = product.metadata;
      if (metadata?.features && Array.isArray(metadata.features)) {
        current.features = metadata.features.filter(
          (value): value is string => typeof value === "string"
        );
      }
      if (metadata?.permissions && Array.isArray(metadata.permissions)) {
        current.permissions = metadata.permissions.filter(
          (value): value is string => typeof value === "string"
        );
      }
      if (metadata?.limits && typeof metadata.limits === "object") {
        current.limits = Object.fromEntries(
          Object.entries(metadata.limits).filter(
            (entry): entry is [string, number] =>
              typeof entry[1] === "number" && Number.isFinite(entry[1])
          )
        );
      }
    }
  }

  return Object.values(tiers);
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
    onError: (error: Error) => {
      toast.error(error.message || "Failed to change plan");
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
    onError: (error: Error) => {
      toast.error(error.message || "Failed to open billing portal");
    },
  });

  const products = productsQuery.data?.products || [];
  const subscriptions = subscriptionsQuery.data?.subscriptions || [];

  console.log("Subscriptions: ", subscriptions);

  const activeSubscription =
    subscriptions.find((sub) => {
      if (sub.status === "active") {
        return true;
      }

      if (
        sub.status === "canceled" &&
        sub.currentPeriodEnd &&
        new Date(sub.currentPeriodEnd) > new Date()
      ) {
        return true;
      }

      return false;
    }) || null;

  console.log("Active subscription: ", activeSubscription);

  // TODO: Mercado Pago no tiene metadata, no estamos obteniendo ningún tier, esto hay que sacarlo de la base.

  const currentTier = parseTierIdFromName(
    (activeSubscription?.metadata?.tier as string | undefined) ||
      (activeSubscription?.metadata?.planId as string | undefined) ||
      activeSubscription?.productName
  );

  console.log("Current tier: ", currentTier);

  const dbPlans = productsQuery.data?.plans;

  console.log("Products Query: ", productsQuery.data);

  console.log("DB Plans: ", dbPlans);

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
          organizationId,
        },
      });
    },
    [checkoutMutation]
  );

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
    void queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
  }, [queryClient]);

  const hasFeature = useCallback(
    (feature: string) => {
      if (!tierConfig) {
        return false;
      }
      return tierConfig.features.some((value) =>
        value.toLowerCase().includes(feature.toLowerCase())
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

  const value: MembershipContextValue = {
    currentTier,
    tierConfig,
    isLoading,
    error,
    subscriptions,
    activeSubscription,
    orders: [],
    meters: [],
    benefits: [],
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
