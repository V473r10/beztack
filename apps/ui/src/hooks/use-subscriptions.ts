/**
 * Unified Subscriptions Hook
 * Works with both Polar and Mercado Pago based on PAYMENT_PROVIDER config
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { env } from "@/env";

const API_URL = env.VITE_API_URL;

export type Product = {
  id: string;
  name: string;
  description?: string;
  price: {
    amount: number;
    currency: string;
  };
  interval: "month" | "year" | "day" | "week";
  intervalCount: number;
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
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
};

export type CheckoutResult = {
  provider: string;
  checkoutId: string;
  checkoutUrl: string;
};

async function fetchProducts(): Promise<{
  provider: string;
  products: Product[];
}> {
  const response = await fetch(`${API_URL}/api/subscriptions/products`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Failed to fetch products");
  }
  return response.json();
}

async function fetchSubscriptions(): Promise<{
  provider: string;
  subscriptions: Subscription[];
}> {
  const response = await fetch(`${API_URL}/api/subscriptions`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Failed to fetch subscriptions");
  }
  return response.json();
}

async function createCheckout(productId: string): Promise<CheckoutResult> {
  const response = await fetch(`${API_URL}/api/subscriptions/checkout`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId }),
  });
  if (!response.ok) {
    throw new Error("Failed to create checkout");
  }
  return response.json();
}

async function cancelSubscription(
  subscriptionId: string,
  immediately = false
): Promise<void> {
  const response = await fetch(
    `${API_URL}/api/subscriptions/${subscriptionId}?immediately=${immediately}`,
    {
      method: "DELETE",
      credentials: "include",
    }
  );
  if (!response.ok) {
    throw new Error("Failed to cancel subscription");
  }
}

async function updateSubscription(
  subscriptionId: string,
  updates: { status?: "pause" | "resume"; productId?: string }
): Promise<Subscription> {
  const response = await fetch(
    `${API_URL}/api/subscriptions/${subscriptionId}`,
    {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    }
  );
  if (!response.ok) {
    throw new Error("Failed to update subscription");
  }
  const data = await response.json();
  return data.subscription;
}

export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: fetchProducts,
  });
}

export function useSubscriptions() {
  return useQuery({
    queryKey: ["subscriptions"],
    queryFn: fetchSubscriptions,
  });
}

export function useCheckout() {
  return useMutation({
    mutationFn: createCheckout,
    onSuccess: (data) => {
      window.location.href = data.checkoutUrl;
    },
  });
}

export function useCancelSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      subscriptionId,
      immediately,
    }: {
      subscriptionId: string;
      immediately?: boolean;
    }) => cancelSubscription(subscriptionId, immediately),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
    },
  });
}

export function useUpdateSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      subscriptionId,
      updates,
    }: {
      subscriptionId: string;
      updates: { status?: "pause" | "resume"; productId?: string };
    }) => updateSubscription(subscriptionId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
    },
  });
}

export function usePaymentProvider() {
  return env.VITE_PAYMENT_PROVIDER;
}
