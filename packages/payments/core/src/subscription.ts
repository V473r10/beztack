/**
 * The Current Subscription rule, shared by the API and the UI.
 *
 * Browser-safe: this entry point imports nothing provider-specific, so the UI
 * can use it without bundling the provider factory.
 */
import type { SubscriptionStatus } from "./types.js";

/** Statuses whose Subscription is in force right now. */
const IN_FORCE_STATUSES: ReadonlySet<string> = new Set<SubscriptionStatus>(["active", "trialing"]);

/**
 * Whether a Subscription counts as the Current Subscription: it is active or
 * trialing, or it was canceled but its paid period has not ended yet.
 */
export function isCurrentSubscription(
  subscription: {
    status: string | null | undefined;
    currentPeriodEnd?: Date | string | null;
  },
  now: Date = new Date(),
): boolean {
  if (subscription.status && IN_FORCE_STATUSES.has(subscription.status)) {
    return true;
  }

  if (subscription.status !== "canceled" || !subscription.currentPeriodEnd) {
    return false;
  }

  return new Date(subscription.currentPeriodEnd).getTime() > now.getTime();
}
