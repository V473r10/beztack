/**
 * Unified Checkout endpoint
 * Works with both Polar and Mercado Pago based on PAYMENT_PROVIDER config
 */

import type { PaymentProviderAdapter } from "@beztack/payments";
import { createError, defineEventHandler, readBody } from "h3";
import { z } from "zod";
import { env } from "@/env";
import { ensurePaymentProvider } from "@/lib/payments";
import { resolveProductByCanonicalPlan } from "@/lib/payments/catalog";
import { enrichProductWithCatalog } from "@/lib/payments/catalog-mp";
import type { Product } from "@/lib/payments/types";
import {
  applyAdminTierOverride,
  isAppAdminActor,
} from "@/server/utils/admin-tier-override";
import { resolveCheckoutCallbackUrls } from "@/server/utils/checkout-callback-urls";
import { type AuthenticatedUser, requireAuth } from "@/server/utils/membership";

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

type CheckoutInput = z.infer<typeof checkoutSchema>;

function getAppAdminEmails(): string[] {
  return env.APP_ADMIN_EMAILS.split(",")
    .map((email: string) => email.trim().toLowerCase())
    .filter(Boolean);
}

function getAuthRole(auth: AuthenticatedUser): string | string[] | null {
  const role = (auth.user as { role?: unknown }).role;
  if (typeof role === "string") {
    return role;
  }
  if (Array.isArray(role) && role.every((entry) => typeof entry === "string")) {
    return role;
  }
  return null;
}

function resolveCheckoutOrganizationId(
  parsed: CheckoutInput,
  auth: AuthenticatedUser
): string | undefined {
  if (env.SUBSCRIPTION_MODE !== "organization") {
    return;
  }

  return (
    parsed.organizationId ?? auth.session?.activeOrganizationId ?? undefined
  );
}

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

  try {
    const body = await readBody(event);
    const parsed = checkoutSchema.parse(body);
    const appAdminEmails = getAppAdminEmails();
    const actor = {
      id: auth.user.id,
      email: auth.user.email,
      role: getAuthRole(auth),
    };
    const organizationId = resolveCheckoutOrganizationId(parsed, auth);

    if (isAppAdminActor(actor, appAdminEmails)) {
      const result = await applyAdminTierOverride({
        actor,
        appAdminEmails,
        billingPeriod: parsed.billingPeriod,
        organizationId,
        planId: parsed.planId,
        productId: parsed.productId,
        provider: env.PAYMENT_PROVIDER,
        sourceAction: "checkout",
        subscriptionMode:
          env.SUBSCRIPTION_MODE === "organization" ? "organization" : "user",
        userId: auth.user.id,
      });

      return {
        provider: "beztack",
        resultKind: result.kind,
        changed: result.changed,
        adminTierOverride: {
          target: result.target,
          tier: result.override.tier,
          billingCadence: result.override.billingCadence,
          realSubscriptionsUnchanged: true,
        },
      };
    }

    const provider = await ensurePaymentProvider();
    const checkoutUrls = resolveCheckoutCallbackUrls({
      configuredSuccessUrl: env.PAYMENTS_SUCCESS_URL || env.POLAR_SUCCESS_URL,
      configuredCancelUrl: env.PAYMENTS_CANCEL_URL || env.POLAR_CANCEL_URL,
    });

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

    const checkoutMetadata = buildCheckoutMetadata(
      parsed,
      auth.user.id,
      organizationId,
      productTierId
    );

    if (parsed.upgrade) {
      throw createError({
        statusCode: 410,
        message:
          "Subscription Plan changes must use the Plan change acceptance route",
      });
    }

    const result = await provider.createCheckout({
      productId: selectedProduct.id,
      customerEmail: auth.user.email,
      customerId: auth.user.id,
      successUrl: checkoutUrls.successUrl,
      cancelUrl: checkoutUrls.cancelUrl,
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
