import type { PaymentProviderAdapter, Subscription } from "@beztack/payments";
import { isCurrentSubscription } from "@beztack/payments/subscription";
import { createError, defineEventHandler, readBody } from "h3";
import { z } from "zod";
import { env } from "@/env";
import { ensurePaymentProvider } from "@/lib/payments";
import { type AuthenticatedUser, requireAuth } from "@/server/utils/membership";
import {
  cancelPendingPlanChange,
  PlanChangeError,
  type PlanChangeStore,
} from "@/server/utils/plan-change";
import { createDbPendingPlanChangeLedger } from "@/server/utils/pending-plan-change-ledger";
import { discoverSubscriptionsFromDb } from "@/server/utils/subscription-discovery";
import { organizationAccess } from "@/server/domain/organization-access";
import { requireOrganizationBillingManagerAccess } from "@/server/utils/organization-access";

const planChangePendingCancellationSchema = z.object({
  organizationId: z.string().min(1).optional(),
});

type PlanChangePendingCancellationRequest = z.infer<typeof planChangePendingCancellationSchema>;

function resolvePaymentIntegrationId(providerName: string): string | undefined {
  if (providerName === "mercadopago") {
    return env.MERCADO_PAGO_APPLICATION_ID || undefined;
  }

  return;
}

function resolveMembershipTarget(
  auth: AuthenticatedUser,
  body: PlanChangePendingCancellationRequest,
) {
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
        organizationId: readMembershipTargetId(currentSubscription, "organization"),
        subscriptionOwnerUserId: readMembershipTargetId(currentSubscription, "user"),
      };
    },
    listActiveVisiblePricingCatalogPlans() {
      return Promise.resolve([]);
    },
    moveMembershipToPlan() {
      return Promise.resolve();
    },
  };
}

function rethrowPlanChangeCancellationError(error: unknown): never {
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
      message: "Invalid Pending Plan change cancellation request",
    });
  }

  throw createError({
    statusCode: 500,
    message: error instanceof Error ? error.message : "Failed to cancel Pending Plan change",
  });
}

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);

  try {
    const body = planChangePendingCancellationSchema.parse((await readBody(event)) ?? {});
    const provider = await ensurePaymentProvider();
    const paymentIntegrationId = resolvePaymentIntegrationId(provider.provider);
    const membershipTarget = resolveMembershipTarget(auth, body);
    if (membershipTarget.type === "organization") {
      await requireOrganizationBillingManagerAccess(auth, membershipTarget.id);
    }
    const cancellation = await cancelPendingPlanChange({
      actor: {
        email: auth.user.email,
        isAppAdmin: organizationAccess.isAppAdmin(auth.user),
        // The gate above refused everyone else for an organization target.
        isBillingManager: membershipTarget.type === "organization",
        userId: auth.user.id,
      },
      membershipTarget,
      paymentProvider: provider.provider,
      paymentIntegrationId,
      store: createPlanChangeStore({ auth, provider }),
    });

    return {
      provider: provider.provider,
      pendingPlanChangeCancellation: cancellation,
    };
  } catch (error) {
    rethrowPlanChangeCancellationError(error);
  }
});
