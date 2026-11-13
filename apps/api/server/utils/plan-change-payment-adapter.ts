import {
  isSubscriptionUpdateNotAppliedError,
  type PaymentProviderAdapter,
} from "@beztack/payments";
import {
  type PlanChangeBillingCadence,
  PlanChangeError,
  type PlanChangePaymentAdapter,
} from "./plan-change";

const SINGLE_INTERVAL_COUNT = 1;
const HTTP_CONFLICT = 409;

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
      if (provider.capabilities.proratedUpgrade) {
        // The provider moves the Subscription to the higher Product itself and
        // invoices the prorated difference right away, so there is no second
        // Subscription to pay at a redirect. The charge settles on the
        // provider's own webhook, so the first Payment is still pending here
        // and Membership moves when the projection sees the new Product.
        let upgraded: Awaited<ReturnType<typeof provider.updateSubscription>>;
        try {
          upgraded = await provider.updateSubscription(input.currentSubscriptionId, {
            productId: input.targetPlan.providerPlanId ?? input.targetPlan.id,
            prorationBehavior: "invoice",
          });
        } catch (error) {
          if (isSubscriptionUpdateNotAppliedError(error)) {
            throw new PlanChangeError("provider_did_not_apply", error.message, HTTP_CONFLICT);
          }
          throw error;
        }

        return {
          firstPayment: { id: upgraded.id, status: "pending" as const },
          providerConfirmedPlanChangeId: upgraded.id,
          redirectUrl: undefined,
        };
      }

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
