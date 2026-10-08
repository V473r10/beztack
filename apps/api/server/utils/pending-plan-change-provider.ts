import {
  isSubscriptionUpdateNotAppliedError,
  type PaymentProviderAdapter,
} from "@beztack/payments";
import type { PendingPlanChangeProviderPort } from "./plan-change";

/**
 * The Payment provider side of activating a Pending Plan change, over the
 * core `updateSubscription({ productId })`: "charge the target plan's terms
 * from the next charge". Mercado Pago does it as an amount change, Polar with
 * its native product change; each adapter verifies the result and throws
 * `SubscriptionUpdateNotAppliedError` when the provider ignored it.
 */
export function createPendingPlanChangeProviderPort(
  getAdapter: () => Promise<Pick<PaymentProviderAdapter, "updateSubscription">>,
): PendingPlanChangeProviderPort {
  return {
    async applyPlanChange({ subscriptionId, targetPlan }) {
      const adapter = await getAdapter();
      try {
        await adapter.updateSubscription(subscriptionId, {
          productId: targetPlan.providerPlanId ?? targetPlan.id,
          // Activation happens at renewal, after the provider may already have
          // charged the old terms for the new period: credit the difference.
          prorationBehavior: "prorate",
        });
      } catch (error) {
        if (isSubscriptionUpdateNotAppliedError(error)) {
          return { applied: false, reason: error.message };
        }
        throw error;
      }

      return { applied: true };
    },
  };
}
