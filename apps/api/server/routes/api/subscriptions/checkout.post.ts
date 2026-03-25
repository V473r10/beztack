/**
 * Unified Checkout endpoint
 * Works with both Polar and Mercado Pago based on PAYMENT_PROVIDER config
 */

import { calculateProration } from "@beztack/mercadopago";
import type { PaymentProviderAdapter, Subscription } from "@beztack/payments";
import { createError, defineEventHandler, readBody } from "h3";
import { z } from "zod";
import { env } from "@/env";
import { ensurePaymentProvider } from "@/lib/payments";
import { resolveProductByCanonicalPlan } from "@/lib/payments/catalog";
import { enrichProductWithCatalog } from "@/lib/payments/catalog-mp";
import type { Product } from "@/lib/payments/types";
import { requireAuth } from "@/server/utils/membership";
import { discoverSubscriptionsFromDb } from "@/server/utils/subscription-discovery";

const TIER_IDS = ["free", "basic", "pro", "ultimate"] as const;

const checkoutSchema = z.object({
  productId: z.string().min(1).optional(),
  planId: z.enum(TIER_IDS).optional(),
  billingPeriod: z.enum(["monthly", "yearly"]).default("monthly"),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  organizationId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  upgrade: z.boolean().optional(),
});

async function findActiveSubscription(
  provider: PaymentProviderAdapter,
  userId: string,
  email: string
): Promise<Subscription | null> {
  let subscriptions = await provider.listSubscriptions({
    customerEmail: email,
    customerId: userId,
  });

  if (subscriptions.length === 0) {
    subscriptions = await discoverSubscriptionsFromDb(userId, provider);
  }

  // Prefer authorized (active) subscription
  const active = subscriptions.find((sub) => sub.status === "active");
  if (active) {
    return active;
  }

  // Upgrade-specific: also check for pending subscriptions (just created,
  // first payment not yet processed by MercadoPago).
  // Note: "pending" string matches between core SubscriptionStatus and MP API.
  const pendingSubs = await provider.listSubscriptions({
    customerEmail: email,
    customerId: userId,
    status: "pending",
  });

  return pendingSubs.at(0) ?? null;
}

async function handleProratedUpgrade(options: {
  provider: PaymentProviderAdapter;
  activeSub: Subscription;
  selectedProduct: Product;
  metadata: Record<string, unknown>;
  userEmail: string;
}): Promise<{ id: string; url: string }> {
  const { provider, activeSub, selectedProduct, metadata, userEmail } = options;
  const currentAmount =
    typeof activeSub.metadata?.billingAmount === "number"
      ? activeSub.metadata.billingAmount
      : 0;
  const currentCurrency =
    typeof activeSub.metadata?.billingCurrency === "string"
      ? activeSub.metadata.billingCurrency
      : "UYU";
  const currentInterval =
    typeof activeSub.metadata?.billingInterval === "string"
      ? activeSub.metadata.billingInterval
      : "month";

  const periodStart = activeSub.currentPeriodStart ?? new Date();
  const periodEnd = activeSub.currentPeriodEnd ?? new Date();
  const newAmount = selectedProduct.price.amount;

  const proration = calculateProration({
    currentAmount,
    newAmount,
    periodStart,
    periodEnd,
  });

  // Create new subscription with prorated first payment
  const newSub = await provider.createSubscription({
    customerEmail: userEmail,
    customerId: activeSub.customerId,
    customPlan: {
      reason: selectedProduct.name,
      amount: proration.proratedAmount,
      currency: currentCurrency,
      interval: currentInterval as "month" | "year" | "day" | "week",
      intervalCount: 1,
    },
    metadata: {
      ...metadata,
      proratedUpgrade: true,
      fullAmount: newAmount,
      targetPlanId: selectedProduct.id,
      previousSubscriptionId: activeSub.id,
    },
  });

  const checkoutUrl =
    typeof newSub.metadata?.initPoint === "string"
      ? newSub.metadata.initPoint
      : undefined;

  if (!checkoutUrl) {
    throw createError({
      statusCode: 500,
      message:
        "Mercado Pago did not return a checkout URL for the prorated subscription",
    });
  }

  return {
    id: newSub.id,
    url: checkoutUrl,
  };
}

type CheckoutInput = z.infer<typeof checkoutSchema>;

function resolveCheckoutProduct(
  products: Product[],
  productId: string | undefined,
  planId: string | undefined,
  billingPeriod: "monthly" | "yearly"
) {
  if (productId) {
    return products.find((product) => product.id === productId) ?? null;
  }

  if (!planId) {
    return null;
  }

  return resolveProductByCanonicalPlan(products, planId, billingPeriod);
}

function validateCheckoutInput(
  parsed: CheckoutInput,
  providerName: string
): void {
  if (providerName === "mercadopago" && parsed.billingPeriod === "yearly") {
    throw createError({
      statusCode: 400,
      message: "Yearly billing is not available with MercadoPago",
    });
  }

  if (!(parsed.productId || parsed.planId)) {
    throw createError({
      statusCode: 400,
      message: "Either productId or planId is required",
    });
  }
}

async function resolveProducts(
  provider: PaymentProviderAdapter
): Promise<Product[]> {
  const providerProducts = await provider.listProducts();
  if (provider.provider === "polar") {
    return providerProducts;
  }
  return Promise.all(providerProducts.map(enrichProductWithCatalog));
}

function buildCheckoutMetadata(
  parsed: CheckoutInput,
  userId: string,
  organizationId: string | undefined,
  productTierId: string | undefined
): Record<string, unknown> {
  return {
    ...parsed.metadata,
    userId,
    ...(organizationId ? { organizationId } : {}),
    tier:
      parsed.planId ??
      productTierId ??
      (typeof parsed.metadata?.tier === "string"
        ? parsed.metadata.tier
        : undefined),
  };
}

function rethrowOrWrap(error: unknown): never {
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

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);
  const provider = await ensurePaymentProvider();
  const successUrl = env.PAYMENTS_SUCCESS_URL || env.POLAR_SUCCESS_URL;
  const cancelUrl = env.PAYMENTS_CANCEL_URL || env.POLAR_CANCEL_URL;

  try {
    const body = await readBody(event);
    const parsed = checkoutSchema.parse(body);

    validateCheckoutInput(parsed, provider.provider);

    const products = await resolveProducts(provider);
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
      ? (parsed.organizationId ??
        auth.session?.activeOrganizationId ??
        undefined)
      : undefined;

    const checkoutMetadata = buildCheckoutMetadata(
      parsed,
      auth.user.id,
      organizationId,
      productTierId
    );

    // Prorated upgrade flow (MercadoPago only)
    if (parsed.upgrade && provider.provider === "mercadopago") {
      const activeSub = await findActiveSubscription(
        provider,
        auth.user.id,
        auth.user.email
      );

      if (!activeSub) {
        throw createError({
          statusCode: 400,
          message: "No active subscription found to upgrade from",
        });
      }

      const result = await handleProratedUpgrade({
        provider,
        activeSub,
        selectedProduct,
        metadata: checkoutMetadata,
        userEmail: auth.user.email,
      });

      return {
        provider: provider.provider,
        checkoutId: result.id,
        checkoutUrl: result.url,
        prorated: true,
      };
    }

    const result = await provider.createCheckout({
      productId: selectedProduct.id,
      customerEmail: auth.user.email,
      customerId: auth.user.id,
      successUrl: parsed.successUrl ?? successUrl,
      cancelUrl: parsed.cancelUrl ?? cancelUrl,
      metadata: checkoutMetadata,
    });

    return {
      provider: provider.provider,
      checkoutId: result.id,
      checkoutUrl: result.url,
    };
  } catch (error) {
    rethrowOrWrap(error);
  }
});
