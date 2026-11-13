import type { PricingTier } from "@/types/pricing";

export type BillingPeriod = "monthly" | "yearly";

/** What choosing a plan on the pricing page does. */
export type PricingAction =
  | { kind: "plan-change"; tier: PricingTier }
  | { kind: "checkout"; productId: string }
  | { kind: "none" };

/**
 * The provider product that sells `tier` for `billingPeriod`. It is the
 * product id checkout takes, not the tier id (`pro`). A catalog-only plan
 * (Free) has no product.
 */
export function resolveTierProductId(
  tier: PricingTier,
  billingPeriod: BillingPeriod,
): string | undefined {
  if (tier.catalogOnly) {
    return;
  }
  return billingPeriod === "yearly" ? tier.yearly?.id : tier.monthly?.id;
}

/**
 * One rule for every button that picks a plan (a card, the closing call to
 * action): someone who already has a Subscription (or an App admin, whose
 * Plan change is an Admin tier override) changes plan in the dialog with its
 * preview, and everyone else starts a checkout of the product for the chosen
 * Billing period.
 */
export function resolvePricingAction(input: {
  billingPeriod: BillingPeriod;
  /** The visitor has a Subscription (or is an App admin): a Plan change, not a checkout. */
  changesPlan: boolean;
  tier: PricingTier;
}): PricingAction {
  const productId = resolveTierProductId(input.tier, input.billingPeriod);
  if (!productId) {
    return { kind: "none" };
  }
  return input.changesPlan
    ? { kind: "plan-change", tier: input.tier }
    : { kind: "checkout", productId };
}
