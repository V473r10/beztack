/**
 * Unified Checkout endpoint
 * Works with both Polar and Mercado Pago based on PAYMENT_PROVIDER config
 */
import { createError, defineEventHandler, readBody } from "h3";
import { z } from "zod";
import { env } from "@/env";
import { getPaymentProvider } from "@/lib/payments";
import { resolveProductByCanonicalPlan } from "@/lib/payments/catalog";
import { enrichProductWithCatalog } from "@/lib/payments/catalog-mp";
import type { Product } from "@/lib/payments/types";
import { requireAuth } from "@/server/utils/membership";

const TIER_IDS = ["free", "basic", "pro", "ultimate"] as const;

const checkoutSchema = z.object({
  productId: z.string().min(1).optional(),
  planId: z.enum(TIER_IDS).optional(),
  billingPeriod: z.enum(["monthly", "yearly"]).default("monthly"),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  organizationId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

function resolveCheckoutProduct(
  products: Product[],
  productId: string | undefined,
  planId: string | undefined,
  billingPeriod: "monthly" | "yearly"
) {
  if (productId) {
    const selected = products.find((product) => product.id === productId);
    if (!selected) {
      return null;
    }
    return selected;
  }

  if (!planId) {
    return null;
  }

  return resolveProductByCanonicalPlan(products, planId, billingPeriod);
}

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);
  const provider = getPaymentProvider();
  const successUrl = env.PAYMENTS_SUCCESS_URL || env.POLAR_SUCCESS_URL;
  const cancelUrl = env.PAYMENTS_CANCEL_URL || env.POLAR_CANCEL_URL;

  try {
    const body = await readBody(event);
    const parsed = checkoutSchema.parse(body);
    if (!(parsed.productId || parsed.planId)) {
      throw createError({
        statusCode: 400,
        message: "Either productId or planId is required",
      });
    }

    const providerProducts = await provider.listProducts();
    // Polar: products already have metadata from API; MP: enrich with DB catalog data
    const products =
      provider.provider === "polar"
        ? providerProducts
        : await Promise.all(providerProducts.map(enrichProductWithCatalog));
    const selectedProduct = resolveCheckoutProduct(
      products,
      parsed.productId,
      parsed.planId,
      parsed.billingPeriod
    );

    if (!selectedProduct) {
      throw createError({
        statusCode: 400,
        message:
          "Could not resolve checkout product for the selected plan and billing period",
      });
    }

    const productTierId =
      typeof selectedProduct.metadata?.tier === "string"
        ? selectedProduct.metadata.tier
        : undefined;
    const isOrgMode = env.SUBSCRIPTION_MODE === "organization";
    const organizationId = isOrgMode
      ? (parsed.organizationId ?? auth.session?.activeOrganizationId)
      : undefined;

    const result = await provider.createCheckout({
      productId: selectedProduct.id,
      customerEmail: auth.user.email,
      customerId: auth.user.id,
      successUrl: parsed.successUrl ?? successUrl,
      cancelUrl: parsed.cancelUrl ?? cancelUrl,
      metadata: {
        ...parsed.metadata,
        userId: auth.user.id,
        ...(organizationId ? { organizationId } : {}),
        tier:
          parsed.planId ??
          productTierId ??
          (typeof parsed.metadata?.tier === "string"
            ? parsed.metadata.tier
            : undefined),
      },
    });

    return {
      provider: provider.provider,
      checkoutId: result.id,
      checkoutUrl: result.url,
    };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
    ) {
      throw error;
    }

    if (error instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        message: "Invalid request data",
      });
    }

    throw createError({
      statusCode: 500,
      message:
        error instanceof Error ? error.message : "Failed to create checkout",
    });
  }
});
