import { db, plan as planTable } from "@beztack/db";
import type { PaymentProviderAdapter, Subscription } from "@beztack/payments";
import { isCurrentSubscription } from "@beztack/payments/subscription";
import { and, eq } from "drizzle-orm";
import { createError, defineEventHandler, readBody } from "h3";
import { z } from "zod";
import { env } from "@/env";
import { ensurePaymentProvider } from "@/lib/payments";
import { type AuthenticatedUser, requireAuth } from "@/server/utils/membership";
import {
  PlanChangeError,
  type PlanChangeStore,
  previewPlanChange,
  classifyBillingCadence,
  requireSubscriptionBillingCadence,
} from "@/server/utils/plan-change";
import { readChargedAmount } from "@/server/utils/billing-amount-resolver";
import { discoverSubscriptionsFromDb } from "@/server/utils/subscription-discovery";
import { organizationAccess } from "@/server/domain/organization-access";
import { requireOrganizationBillingManagerAccess } from "@/server/utils/organization-access";

const TIER_IDS = ["free", "basic", "pro", "ultimate"] as const;

const planChangePreviewSchema = z.object({
  targetPricingCatalogPlanId: z.string().min(1).optional(),
  targetTierId: z.enum(TIER_IDS).optional(),
  targetBillingCadence: z.enum(["monthly", "yearly"]),
  organizationId: z.string().min(1).optional(),
});

type PlanChangePreviewRequest = z.infer<typeof planChangePreviewSchema>;

function resolvePaymentIntegrationId(providerName: string): string | undefined {
  if (providerName === "mercadopago") {
    return env.MERCADO_PAGO_APPLICATION_ID || undefined;
  }

  return;
}

function resolveMembershipTarget(auth: AuthenticatedUser, body: PlanChangePreviewRequest) {
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

function subscriptionMatchesMembershipTarget(
  subscription: Subscription,
  target: ReturnType<typeof resolveMembershipTarget>,
): boolean {
  return readMembershipTargetId(subscription, target.type) === target.id;
}

function createPlanChangeStore(options: {
  auth: AuthenticatedUser;
  /** Null for an App admin, whose Admin tier override preview reads no Subscription. */
  provider: PaymentProviderAdapter | null;
}): PlanChangeStore {
  const { provider } = options;
  return {
    cancelPendingPlanChange() {
      return Promise.resolve(null);
    },
    markPendingPlanChangeActivated() {
      return Promise.resolve(null);
    },
    recordPendingPlanChangeActivationFailure() {
      return Promise.resolve(null);
    },
    async findCurrentSubscription(input) {
      if (!provider) {
        return null;
      }
      let subscriptions = await provider.listSubscriptions({
        customerEmail: options.auth.user.email,
        customerId: options.auth.user.id,
        limit: 100,
      });

      if (subscriptions.length === 0) {
        subscriptions = await discoverSubscriptionsFromDb(options.auth.user.id, provider);
      }

      const currentSubscription = subscriptions
        .filter((subscription) => isCurrentSubscription(subscription))
        .find((subscription) =>
          subscriptionMatchesMembershipTarget(subscription, input.membershipTarget),
        );

      if (!currentSubscription) {
        return null;
      }

      return {
        id: currentSubscription.id,
        paymentProvider: provider.provider,
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
    findPendingPlanChange() {
      return Promise.resolve(null);
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
    moveMembershipToPlan() {
      return Promise.resolve();
    },
    savePendingPlanChange() {
      throw new Error("Plan change preview cannot save state");
    },
  };
}

function rethrowPlanChangePreviewError(error: unknown): never {
  if (error instanceof PlanChangeError) {
    throw createError({
      statusCode: error.statusCode,
      statusMessage: error.statusMessage,
      data: { code: error.code },
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
      message: "Invalid Plan change preview request",
    });
  }

  throw createError({
    statusCode: 500,
    message: error instanceof Error ? error.message : "Failed to create Plan change preview",
  });
}

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);

  try {
    const body = planChangePreviewSchema.parse(await readBody(event));
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
    const isAppAdmin = organizationAccess.isAppAdmin(auth.user);
    // An App admin's preview is an Admin tier override, priced from the
    // Pricing catalog alone, so a Payment provider outage does not block it.
    const provider = isAppAdmin ? null : await ensurePaymentProvider();
    const paymentProvider = provider?.provider ?? env.PAYMENT_PROVIDER;
    const preview = await previewPlanChange({
      actor: {
        email: auth.user.email,
        isAppAdmin,
        // The gate above refused everyone else for an organization target.
        isBillingManager: membershipTarget.type === "organization",
        userId: auth.user.id,
      },
      membershipTarget,
      paymentProvider,
      paymentIntegrationId: resolvePaymentIntegrationId(paymentProvider),
      target: {
        planId: body.targetPricingCatalogPlanId,
        tierId: body.targetTierId,
        billingCadence: body.targetBillingCadence,
      },
      store: createPlanChangeStore({ auth, provider }),
    });

    return {
      provider: paymentProvider,
      planChangePreview: preview,
    };
  } catch (error) {
    rethrowPlanChangePreviewError(error);
  }
});
