import type { PaymentProviderAdapter } from "@beztack/payments";
import type { PlanChangeBillingCadence, PlanChangePaymentAdapter } from "./plan-change";

const SINGLE_INTERVAL_COUNT = 1;

function billingCadenceToInterval(cadence: PlanChangeBillingCadence) {
  return cadence === "yearly" ? "year" : "month";
}

export function createPlanChangePaymentAdapter(
  provider: PaymentProviderAdapter,
  paymentIntegrationId?: string,
): PlanChangePaymentAdapter {
  return {
    paymentProvider: provider.provider,
    paymentIntegrationId,
    capabilities: provider.capabilities,
    async confirmUpgrade(input) {
      const subscription = await provider.createSubscription({
        customerEmail: input.actor.email,
        customerId: input.actor.userId,
        customPlan: {
          amount: input.firstPayment.amount,
          currency: input.firstPayment.currency,
          interval: billingCadenceToInterval(input.targetPlan.billingCadence),
          intervalCount: SINGLE_INTERVAL_COUNT,
          reason: input.targetPlan.id,
        },
        metadata: {
          direction: "upgrade",
          fullAmount: input.firstPayment.fullAmount,
          planChange: true,
          previousSubscriptionId: input.currentSubscriptionId,
          targetPlanId: input.targetPlan.id,
          tier: input.targetPlan.canonicalTierId,
          ...(input.membershipTarget.type === "organization"
            ? { organizationId: input.membershipTarget.id }
            : { userId: input.membershipTarget.id }),
        },
      });

      return {
        firstPayment: {
          id: subscription.id,
          status: "pending" as const,
        },
        providerConfirmedPlanChangeId: subscription.id,
        redirectUrl:
          typeof subscription.metadata?.initPoint === "string"
            ? subscription.metadata.initPoint
            : undefined,
      };
    },
    async confirmPendingPlanChange(input) {
      const productId = input.targetPlan.providerPlanId ?? input.targetPlan.id;
      const product = await provider.getProduct(productId);
      if (!product) {
        throw new Error("Target Pricing catalog plan was not confirmed by provider");
      }

      return {
        providerConfirmedPlanChangeId: product.id,
      };
    },
  };
}
