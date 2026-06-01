/**
 * Preview proration for a subscription upgrade.
 * Returns the prorated first-payment amount alongside the full new tier price.
 *
 * Query params:
 *   - targetProductId: MP plan ID of the new tier
 *   - targetTierId + billingPeriod: alternative canonical resolution
 */

import { calculateProration } from "@beztack/mercadopago";
import type {
  PaymentProviderAdapter,
  Product,
  Subscription,
} from "@beztack/payments";
import { createError, defineEventHandler, getQuery } from "h3";
import { env } from "@/env";
import { ensurePaymentProvider } from "@/lib/payments";
import { resolveProductByCanonicalPlan } from "@/lib/payments/catalog";
import { enrichProductWithCatalog } from "@/lib/payments/catalog-mp";
import {
  estimatePeriodEnd,
  resolveCurrentBillingAmount,
} from "@/server/utils/billing-amount-resolver";
import { type AuthenticatedUser, requireAuth } from "@/server/utils/membership";
import { discoverSubscriptionsFromDb } from "@/server/utils/subscription-discovery";
import { isSubscriptionOwnedByUser } from "@/server/utils/subscription-ownership";

async function resolveActiveSubscription(
  provider: PaymentProviderAdapter,
  auth: AuthenticatedUser
): Promise<Subscription> {
  const userId = auth.user.id;
  const email = auth.user.email;
  let subscriptions = await provider.listSubscriptions({
    customerEmail: email,
    customerId: userId,
  });

  if (subscriptions.length === 0) {
    subscriptions = await discoverSubscriptionsFromDb(userId, provider);
  }

  subscriptions = subscriptions.filter((subscription) =>
    isSubscriptionOwnedByUser(subscription, auth, env.SUBSCRIPTION_MODE)
  );

  const activeSub = subscriptions.find((sub) => sub.status === "active");
  if (activeSub) {
    return activeSub;
  }

  // Upgrade-specific: also check for pending subscriptions
  const pendingSubs = await provider.listSubscriptions({
    customerEmail: email,
    customerId: userId,
    status: "pending",
  });

  const pendingSub = pendingSubs.find((subscription) =>
    isSubscriptionOwnedByUser(subscription, auth, env.SUBSCRIPTION_MODE)
  );
  if (pendingSub) {
    return pendingSub;
  }

  throw createError({
    statusCode: 400,
    message: "No active subscription found to upgrade from",
  });
}

async function resolveTargetProduct(
  provider: PaymentProviderAdapter,
  targetProductId: string | undefined,
  targetTierId: string | undefined,
  billingPeriod: "monthly" | "yearly"
): Promise<Product> {
  const providerProducts = await provider.listProducts();
  const products = await Promise.all(
    providerProducts.map(enrichProductWithCatalog)
  );

  let target = targetProductId
    ? products.find((p) => p.id === targetProductId)
    : undefined;

  if (!target && targetTierId) {
    target =
      resolveProductByCanonicalPlan(products, targetTierId, billingPeriod) ??
      undefined;
  }

  if (!target) {
    throw createError({
      statusCode: 404,
      message: "Target product not found",
    });
  }

  return target;
}

function extractTierName(
  metadata: Record<string, unknown> | undefined,
  fallback: string | undefined
): string {
  if (typeof metadata?.tier === "string") {
    return metadata.tier;
  }
  return fallback ?? "unknown";
}

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);
  const provider = await ensurePaymentProvider();

  const query = getQuery(event);
  const targetProductId =
    typeof query.targetProductId === "string"
      ? query.targetProductId
      : undefined;
  const targetTierId =
    typeof query.targetTierId === "string" ? query.targetTierId : undefined;
  const billingPeriod = query.billingPeriod === "yearly" ? "yearly" : "monthly";

  if (!(targetProductId || targetTierId)) {
    throw createError({
      statusCode: 400,
      message: "Either targetProductId or targetTierId is required",
    });
  }

  const activeSub = await resolveActiveSubscription(provider, auth);

  const currentBilling = await resolveCurrentBillingAmount(activeSub, provider);

  const periodStart = activeSub.currentPeriodStart ?? new Date();
  const periodEnd =
    activeSub.currentPeriodEnd ??
    estimatePeriodEnd(activeSub, currentBilling.interval);

  const targetProduct = await resolveTargetProduct(
    provider,
    targetProductId,
    targetTierId,
    billingPeriod
  );

  const newAmount = targetProduct.price.amount;
  const isDowngrade = newAmount < currentBilling.amount;

  const proration = calculateProration({
    currentAmount: currentBilling.amount,
    newAmount,
    periodStart,
    periodEnd,
  });

  const currentTier = extractTierName(
    activeSub.metadata,
    activeSub.productName
  );
  const targetTier = extractTierName(
    targetProduct.metadata,
    targetProduct.name
  );

  if (isDowngrade) {
    return {
      direction: "downgrade" as const,
      currentAmount: currentBilling.amount,
      newAmount,
      trialDays: proration.daysRemaining,
      savings: currentBilling.amount - newAmount,
      currency: currentBilling.currency,
      currentTier,
      targetTier,
      currentSubscriptionId: activeSub.id,
      targetProductId: targetProduct.id,
    };
  }

  return {
    direction: "upgrade" as const,
    currentAmount: currentBilling.amount,
    newAmount,
    unusedCredit: proration.unusedCredit,
    proratedFirstPayment: proration.proratedAmount,
    fullMonthlyAmount: proration.fullAmount,
    currency: currentBilling.currency,
    daysRemaining: proration.daysRemaining,
    totalDays: proration.totalDays,
    currentTier,
    targetTier,
    currentSubscriptionId: activeSub.id,
    targetProductId: targetProduct.id,
  };
});
