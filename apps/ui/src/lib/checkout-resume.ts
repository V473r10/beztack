/**
 * Resuming a checkout across sign-up: a visitor who picks a plan before having
 * an account goes through sign-up and lands on `/checkout-confirm` with the
 * same plan and Billing cadence.
 */

const CHECKOUT_CONFIRM_PATH = "/checkout-confirm";
const SIGN_UP_PATH = "/auth/sign-up";

export type BillingPeriod = "monthly" | "yearly";

export type CheckoutSelection = {
  tierId: string;
  billingPeriod: BillingPeriod;
};

const TIER_ID_PATTERN = /^[a-z0-9_-]{1,64}$/;

/** The page that resumes the checkout for `selection`. */
export function getCheckoutConfirmPath(selection: CheckoutSelection): string {
  const params = new URLSearchParams({
    tier: selection.tierId,
    billingPeriod: selection.billingPeriod,
  });
  return `${CHECKOUT_CONFIRM_PATH}?${params.toString()}`;
}

/** Sign-up, coming back to resume the checkout for `selection` afterwards. */
export function getSignUpPathForCheckout(selection: CheckoutSelection): string {
  return `${SIGN_UP_PATH}?next=${encodeURIComponent(getCheckoutConfirmPath(selection))}`;
}

/** The plan and Billing cadence carried in `search`, or null when malformed. */
export function readCheckoutSelection(search: string): CheckoutSelection | null {
  const params = new URLSearchParams(search);
  const tierId = params.get("tier");
  const billingPeriod = params.get("billingPeriod");

  if (!(tierId && TIER_ID_PATTERN.test(tierId))) {
    return null;
  }
  if (billingPeriod !== "monthly" && billingPeriod !== "yearly") {
    return null;
  }

  return { tierId, billingPeriod };
}
