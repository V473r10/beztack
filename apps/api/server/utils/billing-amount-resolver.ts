import type { PaymentProviderAdapter, Subscription } from "@beztack/payments";

const INTERVAL_MS: Record<string, number> = {
	day: 86_400_000,
	week: 604_800_000,
	month: 2_592_000_000, // 30 days
	year: 31_536_000_000, // 365 days
};

/**
 * Estimate periodEnd when MercadoPago hasn't returned next_payment_date yet.
 * Uses currentPeriodStart + billing interval from metadata.
 */
export function estimatePeriodEnd(
	activeSub: Subscription,
	interval: string
): Date {
	const start = activeSub.currentPeriodStart;
	if (!start) {
		return new Date();
	}

	const ms = INTERVAL_MS[interval] ?? INTERVAL_MS.month;
	const frequency =
		typeof activeSub.metadata?.billingFrequency === "number"
			? activeSub.metadata.billingFrequency
			: 1;

	return new Date(start.getTime() + ms * frequency);
}

/**
 * Resolve the current billing amount for a subscription.
 *
 * Fallback chain:
 * 1. metadata.billingAmount (set by adapter from auto_recurring.transaction_amount)
 * 2. provider.getProduct(productId) — resolves from MP plan when metadata is missing
 *    (common for just-created subscriptions where MP hasn't processed first payment)
 * 3. Returns 0 as last resort (caller should handle this edge case)
 *
 * Default currency is "UYU" — matches the current deployment (Uruguay).
 */
export const resolveCurrentBillingAmount = async (
	activeSub: Subscription,
	provider: PaymentProviderAdapter
): Promise<{ amount: number; currency: string; interval: string }> => {
  const metaAmount =
    typeof activeSub.metadata?.billingAmount === "number"
      ? activeSub.metadata.billingAmount
      : 0;
  const metaCurrency =
    typeof activeSub.metadata?.billingCurrency === "string"
      ? activeSub.metadata.billingCurrency
      : "UYU";
  const metaInterval =
    typeof activeSub.metadata?.billingInterval === "string"
      ? activeSub.metadata.billingInterval
      : "month";

  if (metaAmount > 0) {
    return {
      amount: metaAmount,
      currency: metaCurrency,
      interval: metaInterval,
    };
  }

  // Fallback: resolve from provider product catalog
  if (activeSub.productId) {
    const product = await provider.getProduct(activeSub.productId);
    if (product) {
      return {
        amount: product.price.amount,
        currency: product.price.currency,
        interval: product.interval,
      };
    }
  }

  return { amount: 0, currency: metaCurrency, interval: metaInterval };
};
