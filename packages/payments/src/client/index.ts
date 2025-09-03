// React hooks for payment and subscription management
export {
  useCustomerState,
  useCustomerSubscriptions,
  useCustomerOrders,
  useCustomerBenefits,
  useCustomerMeters,
  useCheckout,
  useBillingPortal,
  useUsageTracking,
  useMembershipTier,
  useSubscriptionManagement,
  useOrganizationSubscription,
} from "./hooks.ts";

/**
 * Client-side utilities for checkout and billing
 */

/**
 * Generate checkout URL for a specific tier
 */
export function getCheckoutUrl(
  tier: string,
  options?: {
    organizationId?: string;
    successUrl?: string;
    cancelUrl?: string;
  }
): string {
  const params = new URLSearchParams();
  
  params.set("slug", tier);
  
  if (options?.organizationId) {
    params.set("organizationId", options.organizationId);
  }
  
  if (options?.successUrl) {
    params.set("successUrl", options.successUrl);
  }
  
  if (options?.cancelUrl) {
    params.set("cancelUrl", options.cancelUrl);
  }

  return `/polar/checkout?${params.toString()}`;
}

/**
 * Generate billing portal URL
 */
export function getBillingPortalUrl(returnUrl?: string): string {
  const params = new URLSearchParams();
  
  if (returnUrl) {
    params.set("returnUrl", returnUrl);
  }

  return `/polar/portal?${params.toString()}`;
}

/**
 * Format currency amount for display
 */
export function formatCurrency(
  amount: number,
  currency: string = "USD",
  locale: string = "en-US"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Calculate savings for yearly billing
 */
export function calculateYearlySavings(
  monthlyPrice: number,
  yearlyPrice: number
): {
  amount: number;
  percentage: number;
  formattedAmount: string;
  formattedPercentage: string;
} {
  const annualMonthlyPrice = monthlyPrice * 12;
  const savingsAmount = annualMonthlyPrice - yearlyPrice;
  const savingsPercentage = (savingsAmount / annualMonthlyPrice) * 100;

  return {
    amount: savingsAmount,
    percentage: savingsPercentage,
    formattedAmount: formatCurrency(savingsAmount),
    formattedPercentage: `${Math.round(savingsPercentage)}%`,
  };
}

/**
 * Check if subscription is in grace period
 */
export function isSubscriptionInGracePeriod(
  subscription: { status: string; currentPeriodEnd: Date; canceledAt?: Date }
): boolean {
  if (subscription.status !== "canceled" || !subscription.canceledAt) {
    return false;
  }

  const now = new Date();
  return now < subscription.currentPeriodEnd;
}

/**
 * Get subscription renewal date
 */
export function getSubscriptionRenewalDate(
  subscription: { currentPeriodEnd: Date; status: string }
): Date | null {
  if (subscription.status === "active") {
    return subscription.currentPeriodEnd;
  }
  return null;
}

/**
 * Check if customer has specific benefit
 */
export function hasBenefit(benefits: Array<{ type: string; isGranted: boolean }>, benefitType: string): boolean {
  return benefits.some(benefit => benefit.type === benefitType && benefit.isGranted);
}

/**
 * Get usage percentage for a meter
 */
export function getUsagePercentage(
  meter: { currentBalance: number; consumedUnits: number },
  limit?: number
): number | null {
  if (!limit || limit <= 0) {
    return null; // Unlimited usage
  }

  return Math.min((meter.consumedUnits / limit) * 100, 100);
}

/**
 * Check if usage is approaching limit
 */
export function isUsageNearLimit(
  meter: { currentBalance: number; consumedUnits: number },
  limit?: number,
  warningThreshold: number = 80
): boolean {
  const percentage = getUsagePercentage(meter, limit);
  return percentage !== null && percentage >= warningThreshold;
}