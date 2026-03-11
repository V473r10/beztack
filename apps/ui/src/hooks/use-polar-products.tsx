import { env } from "@/env";
import type { PolarPricingTier } from "@/types/polar-pricing";

type Product = {
  id: string;
  name: string;
  description?: string;
  interval: "month" | "year" | "day" | "week";
  price: {
    amount: number;
    currency: string;
  };
  metadata?: Record<string, unknown>;
};

type ProductsResponse = {
  provider: "polar" | "mercadopago";
  products: Product[];
};

function getTierId(product: Product): string {
  const tierId =
    typeof product.metadata?.tier === "string"
      ? product.metadata.tier
      : undefined;
  if (tierId) {
    return tierId;
  }

  const planId =
    typeof product.metadata?.planId === "string"
      ? product.metadata.planId
      : undefined;
  if (planId) {
    return planId;
  }

  return product.id;
}

function getDisplayOrder(product: Product): number {
  const displayOrder = product.metadata?.displayOrder;
  if (typeof displayOrder === "number") {
    return displayOrder;
  }
  return 0;
}

// TODO: Generalizar a cualquier proveedor de pagos
export async function usePolarProducts(): Promise<PolarPricingTier[]> {
  const response = await fetch(
    `${env.VITE_API_URL}/api/subscriptions/products`,
    {
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const payload = (await response.json()) as ProductsResponse;
  const tiers = new Map<string, PolarPricingTier>();

  for (const product of payload.products) {
    const tierId = getTierId(product);
    const baseName = product.name.split(" - ")[0] || product.name;
    const existing = tiers.get(tierId);
    const displayOrder = getDisplayOrder(product);

    const metadata = product.metadata;
    const features = Array.isArray(metadata?.features)
      ? metadata.features.filter(
          (value): value is string => typeof value === "string"
        )
      : [];
    const limits =
      metadata?.limits && typeof metadata.limits === "object"
        ? (metadata.limits as Record<string, number>)
        : {};
    const permissions = Array.isArray(metadata?.permissions)
      ? Object.fromEntries(
          metadata.permissions
            .filter((value): value is string => typeof value === "string")
            .map((permission) => [permission, true])
        )
      : metadata?.permissions && typeof metadata.permissions === "object"
        ? (metadata.permissions as Record<string, boolean>)
        : {};

    const nextTier: PolarPricingTier = existing ?? {
      id: tierId,
      name: baseName,
      description: product.description || `${baseName} tier`,
      price: { monthly: 0, yearly: 0 },
      features,
      limits,
      permissions,
      displayOrder,
    };

    if (product.interval === "month") {
      nextTier.price = {
        ...nextTier.price,
        monthly: product.price.amount,
      };
      nextTier.monthly = {
        id: product.id,
        name: product.name,
        description: product.description ?? null,
        recurringInterval: "month",
        metadata: product.metadata,
        prices: [
          {
            id: product.id,
            priceAmount: Math.round(product.price.amount * 100),
            priceCurrency: product.price.currency,
            recurringInterval: "month",
          },
        ],
      };
    }

    if (product.interval === "year") {
      nextTier.price = {
        ...nextTier.price,
        yearly: product.price.amount,
      };
      nextTier.yearly = {
        id: product.id,
        name: product.name,
        description: product.description ?? null,
        recurringInterval: "year",
        metadata: product.metadata,
        prices: [
          {
            id: product.id,
            priceAmount: Math.round(product.price.amount * 100),
            priceCurrency: product.price.currency,
            recurringInterval: "year",
          },
        ],
      };
    }

    tiers.set(tierId, nextTier);
  }

  return Array.from(tiers.values());
}
