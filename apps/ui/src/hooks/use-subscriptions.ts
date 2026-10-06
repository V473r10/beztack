/**
 * Unified Subscriptions Hook
 * Works with both Polar and Mercado Pago based on PAYMENT_PROVIDER config
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { env } from "@/env";
import { requestJson } from "@/lib/api-client";
import { redirectToExternalUrl } from "@/lib/browser-navigation";
import { queryKeys } from "@/lib/query-keys";

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
  status: "active" | "inactive" | "pending" | "canceled" | "paused" | "past_due";
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

function fetchProducts(): Promise<{
  provider: string;
  products: Product[];
}> {
  return requestJson("/api/subscriptions/products");
}

function fetchSubscriptions(organizationId?: string): Promise<{
  provider: string;
  subscriptions: Subscription[];
}> {
  const query = organizationId ? `?${new URLSearchParams({ organizationId }).toString()}` : "";
  return requestJson(`/api/subscriptions${query}`);
}

function createCheckout(productId: string): Promise<CheckoutResult> {
  return requestJson("/api/subscriptions/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId }),
  });
}

async function cancelSubscription(subscriptionId: string, immediately = false): Promise<void> {
  await requestJson(`/api/subscriptions/${subscriptionId}?immediately=${immediately}`, {
    method: "DELETE",
  });
}

async function updateSubscription(
  subscriptionId: string,
  updates: { status?: "pause" | "resume"; productId?: string },
): Promise<Subscription> {
  const data = await requestJson<{ subscription: Subscription }>(
    `/api/subscriptions/${subscriptionId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    },
  );
  return data.subscription;
}

export function useProducts() {
  return useQuery({
    queryKey: queryKeys.products.all(),
    queryFn: fetchProducts,
  });
}

/** `organizationId` is the Active organization in organization subscription
 * mode; the list is keyed by it so organizations never share billing cache. */
export function useSubscriptions(organizationId?: string) {
  return useQuery({
    queryKey: queryKeys.subscriptions.list(organizationId),
    queryFn: () => fetchSubscriptions(organizationId),
  });
}

export function useCheckout() {
  return useMutation({
    mutationFn: createCheckout,
    onSuccess: (data) => {
      redirectToExternalUrl(data.checkoutUrl);
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
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all() });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all() });
    },
  });
}

export function usePaymentProvider() {
  return env.VITE_PAYMENT_PROVIDER;
}
