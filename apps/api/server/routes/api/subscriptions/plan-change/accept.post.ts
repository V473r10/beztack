import {
  db,
  organization as organizationTable,
  plan as planTable,
  user as userTable,
} from "@beztack/db";
import type { PaymentProviderAdapter, Subscription } from "@beztack/payments";
import { isCurrentSubscription } from "@beztack/payments/subscription";
import { and, eq } from "drizzle-orm";
import { createError, defineEventHandler, readBody } from "h3";
import { z } from "zod";
import { env } from "@/env";
import { ensurePaymentProvider } from "@/lib/payments";
import { type AuthenticatedUser, requireAuth } from "@/server/utils/membership";
import {
  acceptPlanChange,
  type PlanChangeBillingCadence,
  PlanChangeError,
  type PlanChangePaymentAdapter,
  type PlanChangeStore,
  classifyBillingCadence,
  requireSubscriptionBillingCadence,
} from "@/server/utils/plan-change";
import { createDbPendingPlanChangeLedger } from "@/server/utils/pending-plan-change-ledger";
import { readChargedAmount } from "@/server/utils/billing-amount-resolver";
import { discoverSubscriptionsFromDb } from "@/server/utils/subscription-discovery";
import { organizationAccess, getAppAdminEmails } from "@/server/domain/organization-access";
import { applyAdminTierOverride } from "@/server/utils/admin-tier-override";
import { requireOrganizationBillingManagerAccess } from "@/server/utils/organization-access";

function readAuthRole(auth: AuthenticatedUser): string | string[] | null {
  const role = (auth.user as { role?: unknown }).role;
  if (typeof role === "string") {
    return role;
  }
  if (Array.isArray(role) && role.every((entry) => typeof entry === "string")) {
    return role;
  }
  return null;
}

const TIER_IDS = ["free", "basic", "pro", "ultimate"] as const;
const SINGLE_INTERVAL_COUNT = 1;

const planChangeAcceptSchema = z.object({
  targetPricingCatalogPlanId: z.string().min(1).optional(),
  targetTierId: z.enum(TIER_IDS).optional(),
  targetBillingCadence: z.enum(["monthly", "yearly"]),
  organizationId: z.string().min(1).optional(),
});

type PlanChangeAcceptRequest = z.infer<typeof planChangeAcceptSchema>;

function resolvePaymentIntegrationId(providerName: string): string | undefined {
  if (providerName === "mercadopago") {
    return env.MERCADO_PAGO_APPLICATION_ID || undefined;
  }

  return;
}

function resolveMembershipTarget(auth: AuthenticatedUser, body: PlanChangeAcceptRequest) {
  if (env.SUBSCRIPTION_MODE === "organization") {
    const organizationId = body.organizationId ?? auth.session.activeOrganizationId ?? undefined;
    if (!organizationId) {
      throw createError({
        statusCode: 400,
        message: "An organization Membership target is required",
      });
    }

    return { type: "organization" as const, id: organizationId };
  }

  return { type: "user" as const, id: auth.user.id };
}

function readString(source: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = source?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readMembershipTargetId(
  subscription: Subscription,
  targetType: "user" | "organization",
): string | undefined {
  if (targetType === "organization") {
    return (
      readString(subscription.metadata, "organizationId") ??
      readString(subscription.metadata, "referenceId")
    );
  }

  return (
    readString(subscription.metadata, "userId") ??
    (readString(subscription.metadata, "referenceId") !==
    readString(subscription.metadata, "organizationId")
      ? readString(subscription.metadata, "referenceId")
      : undefined) ??
    subscription.customerId
  );
}

function subscriptionMatchesTarget(
  subscription: Subscription,
  target: ReturnType<typeof resolveMembershipTarget>,
): boolean {
  return readMembershipTargetId(subscription, target.type) === target.id;
}

function createPlanChangeStore(options: {
  auth: AuthenticatedUser;
  provider: PaymentProviderAdapter;
}): PlanChangeStore {
  return {
    ...createDbPendingPlanChangeLedger(),
    async findCurrentSubscription(input) {
      let subscriptions = await options.provider.listSubscriptions({
        customerEmail: options.auth.user.email,
        customerId: options.auth.user.id,
        limit: 100,
      });

      if (subscriptions.length === 0) {
        subscriptions = await discoverSubscriptionsFromDb(options.auth.user.id, options.provider);
      }

      const currentSubscription = subscriptions
        .filter((subscription) => isCurrentSubscription(subscription))
        .find((subscription) => subscriptionMatchesTarget(subscription, input.membershipTarget));
      if (!currentSubscription) {
        return null;
      }

      return {
        id: currentSubscription.id,
        paymentProvider: options.provider.provider,
        paymentIntegrationId: readString(currentSubscription.metadata, "providerIntegrationId"),
        providerPlanId: currentSubscription.productId,
        canonicalTierId:
          readString(currentSubscription.metadata, "tier") ??
          readString(currentSubscription.metadata, "planId"),
        billingCadence: requireSubscriptionBillingCadence(currentSubscription.metadata),
        organizationId: readMembershipTargetId(currentSubscription, "organization"),
        subscriptionOwnerUserId: readMembershipTargetId(currentSubscription, "user"),
        currentPeriodStart: currentSubscription.currentPeriodStart,
        currentPeriodEnd: currentSubscription.currentPeriodEnd,
        currentPeriodChargedAmount: readChargedAmount(currentSubscription),
      };
    },
    async listActiveVisiblePricingCatalogPlans(paymentProvider) {
      const rows = await db
        .select({
          id: planTable.id,
          provider: planTable.provider,
          providerPlanId: planTable.providerPlanId,
          canonicalTierId: planTable.canonicalTierId,
          displayOrder: planTable.displayOrder,
          price: planTable.price,
          currency: planTable.currency,
          interval: planTable.interval,
          intervalCount: planTable.intervalCount,
        })
        .from(planTable)
        .where(
          and(
            eq(planTable.provider, paymentProvider),
            eq(planTable.visible, true),
            eq(planTable.status, "active"),
          ),
        );

      return rows.flatMap((row) => {
        const billingCadence = classifyBillingCadence(row);
        if (!billingCadence) {
          return [];
        }

        return [
          {
            id: row.id,
            paymentProvider: row.provider,
            providerPlanId: row.providerPlanId,
            canonicalTierId: row.canonicalTierId,
            tierRank: row.displayOrder ?? 0,
            billingCadence,
            price: {
              amount: Number(row.price),
              currency: row.currency,
            },
          },
        ];
      });
    },
    async moveMembershipToPlan(input) {
      const updates = {
        subscriptionTier: input.targetPlan.canonicalTierId,
        subscriptionBillingCadence: input.targetPlan.billingCadence,
        subscriptionStatus: "active",
        subscriptionId: input.subscriptionId,
      };

      if (input.membershipTarget.type === "organization") {
        await db
          .update(organizationTable)
          .set(updates)
          .where(eq(organizationTable.id, input.membershipTarget.id));
        return;
      }

      await db.update(userTable).set(updates).where(eq(userTable.id, input.membershipTarget.id));
    },
  };
}

function billingCadenceToInterval(cadence: PlanChangeBillingCadence) {
  return cadence === "yearly" ? "year" : "month";
}

function createPaymentAdapter(
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

function rethrowPlanChangeAcceptError(error: unknown): never {
  if (error instanceof PlanChangeError) {
    throw createError({
      data: { code: error.code },
      statusCode: error.statusCode,
      statusMessage: error.statusMessage,
    });
  }

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
      message: "Invalid Plan change acceptance request",
    });
  }

  throw createError({
    statusCode: 500,
    message: error instanceof Error ? error.message : "Failed to accept Plan change",
  });
}

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);

  try {
    const body = planChangeAcceptSchema.parse(await readBody(event));
    if (!(body.targetPricingCatalogPlanId || body.targetTierId)) {
      throw createError({
        statusCode: 400,
        message: "A target Plan or target tier is required",
      });
    }

    const membershipTarget = resolveMembershipTarget(auth, body);
    if (membershipTarget.type === "organization") {
      await requireOrganizationBillingManagerAccess(auth, membershipTarget.id);
    }

    // An App admin's Plan change is an Admin tier override, as its preview
    // said: Beztack-owned, immediate, no Payment, no provider call.
    if (organizationAccess.isAppAdmin(auth.user)) {
      const result = await applyAdminTierOverride({
        actor: {
          id: auth.user.id,
          email: auth.user.email,
          role: readAuthRole(auth),
        },
        appAdminEmails: getAppAdminEmails(),
        billingPeriod: body.targetBillingCadence,
        organizationId: membershipTarget.type === "organization" ? membershipTarget.id : undefined,
        planId: body.targetTierId,
        productId: body.targetPricingCatalogPlanId,
        provider: env.PAYMENT_PROVIDER,
        sourceAction: "plan_change",
        subscriptionMode: membershipTarget.type,
        userId: auth.user.id,
      });

      return {
        provider: "beztack",
        planChangeAcceptance: {
          kind: "admin-tier-override",
          changed: result.changed,
          target: result.target,
          tier: result.override.tier,
          billingCadence: result.override.billingCadence,
          realSubscriptionsUnchanged: true,
        },
      };
    }

    const provider = await ensurePaymentProvider();
    const paymentIntegrationId = resolvePaymentIntegrationId(provider.provider);
    const acceptance = await acceptPlanChange({
      actor: {
        email: auth.user.email,
        isAppAdmin: false,
        // The gate above refused everyone else for an organization target.
        isBillingManager: membershipTarget.type === "organization",
        userId: auth.user.id,
      },
      membershipTarget,
      paymentAdapter: createPaymentAdapter(provider, paymentIntegrationId),
      paymentProvider: provider.provider,
      paymentIntegrationId,
      target: {
        planId: body.targetPricingCatalogPlanId,
        tierId: body.targetTierId,
        billingCadence: body.targetBillingCadence,
      },
      store: createPlanChangeStore({ auth, provider }),
    });

    return {
      provider: provider.provider,
      planChangeAcceptance: acceptance,
    };
  } catch (error) {
    rethrowPlanChangeAcceptError(error);
  }
});
