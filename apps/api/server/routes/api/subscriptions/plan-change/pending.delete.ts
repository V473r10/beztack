import {
  db,
  member as memberTable,
  organization as organizationTable,
  pendingPlanChange as pendingPlanChangeTable,
} from "@beztack/db";
import type { PaymentProviderAdapter, Subscription } from "@beztack/payments";
import { and, eq } from "drizzle-orm";
import { createError, defineEventHandler, readBody } from "h3";
import { z } from "zod";
import { env } from "@/env";
import { ensurePaymentProvider } from "@/lib/payments";
import { type AuthenticatedUser, requireAuth } from "@/server/utils/membership";
import {
  cancelPendingPlanChange,
  type PendingPlanChangeRecord,
  type PlanChangeBillingCadence,
  type PlanChangeCatalogPlan,
  PlanChangeError,
  type PlanChangeStore,
} from "@/server/utils/plan-change";
import { discoverSubscriptionsFromDb } from "@/server/utils/subscription-discovery";

const DEFAULT_BILLING_MANAGER_ROLE = "owner";

const planChangePendingCancellationSchema = z.object({
  organizationId: z.string().min(1).optional(),
});

type PlanChangePendingCancellationRequest = z.infer<
  typeof planChangePendingCancellationSchema
>;

type PendingPlanChangeRow = {
  direction: string;
  effectiveAt: Date | null;
  id: string;
  membershipTargetId: string;
  membershipTargetType: string;
  providerConfirmedPlanChangeId: string;
  subscriptionId: string;
  targetPlanSnapshot: {
    id: string;
    paymentProvider: string;
    providerPlanId: string | null;
    canonicalTierId: string;
    tierRank: number;
    billingCadence: string;
    price: {
      amount: number;
      currency: string;
    };
  } | null;
};

function resolvePaymentIntegrationId(providerName: string): string | undefined {
  if (providerName === "mercadopago") {
    return env.MERCADO_PAGO_APPLICATION_ID || undefined;
  }

  return;
}

function resolveMembershipTarget(
  auth: AuthenticatedUser,
  body: PlanChangePendingCancellationRequest
) {
  if (env.SUBSCRIPTION_MODE === "organization") {
    const organizationId =
      body.organizationId ?? auth.session.activeOrganizationId ?? undefined;
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

function getAuthRole(auth: AuthenticatedUser): string | string[] | null {
  const role = (auth.user as { role?: unknown }).role;
  if (typeof role === "string") {
    return role;
  }
  if (Array.isArray(role) && role.every((entry) => typeof entry === "string")) {
    return role;
  }
  return null;
}

function isAppAdmin(auth: AuthenticatedUser): boolean {
  const role = getAuthRole(auth);
  if (!(role?.includes("sudo") ?? false)) {
    return false;
  }

  return env.APP_ADMIN_EMAILS.split(",")
    .map((email: string) => email.trim().toLowerCase())
    .filter(Boolean)
    .includes(auth.user.email.trim().toLowerCase());
}

function readString(
  source: Record<string, unknown> | undefined,
  key: string
): string | undefined {
  const value = source?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isCurrentSubscription(subscription: Subscription): boolean {
  return Boolean(
    subscription.status === "active" ||
      (subscription.status === "canceled" &&
        subscription.currentPeriodEnd &&
        subscription.currentPeriodEnd > new Date())
  );
}

function readMembershipTargetId(
  subscription: Subscription,
  targetType: "user" | "organization"
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

function roleListIncludes(role: string | null, expectedRole: string): boolean {
  return (role ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .includes(expectedRole);
}

function subscriptionMatchesTarget(
  subscription: Subscription,
  target: ReturnType<typeof resolveMembershipTarget>
): boolean {
  return readMembershipTargetId(subscription, target.type) === target.id;
}

function isPlanChangeBillingCadence(
  value: string
): value is PlanChangeBillingCadence {
  return value === "monthly" || value === "yearly";
}

function mapPendingDirection(
  direction: string
): PendingPlanChangeRecord["direction"] {
  if (direction === "downgrade" || direction === "cadence_change") {
    return direction;
  }

  throw new Error("Stored Pending Plan change has an invalid direction");
}

function mapPendingMembershipTarget(input: {
  id: string;
  type: string;
}): PendingPlanChangeRecord["membershipTarget"] {
  if (input.type === "user" || input.type === "organization") {
    return { type: input.type, id: input.id };
  }

  throw new Error(
    "Stored Pending Plan change has an invalid Membership target"
  );
}

function mapTargetPlanSnapshot(
  snapshot: PendingPlanChangeRow["targetPlanSnapshot"]
): PlanChangeCatalogPlan {
  if (!snapshot) {
    throw new Error("Stored Pending Plan change is missing its target Plan");
  }

  if (!isPlanChangeBillingCadence(snapshot.billingCadence)) {
    throw new Error(
      "Stored Pending Plan change target Plan has an invalid Billing cadence"
    );
  }

  return {
    ...snapshot,
    billingCadence: snapshot.billingCadence,
  };
}

function mapPendingPlanChangeRecord(
  row: PendingPlanChangeRow
): PendingPlanChangeRecord {
  return {
    direction: mapPendingDirection(row.direction),
    effectiveAt: row.effectiveAt,
    id: row.id,
    membershipTarget: mapPendingMembershipTarget({
      id: row.membershipTargetId,
      type: row.membershipTargetType,
    }),
    providerConfirmedPlanChangeId: row.providerConfirmedPlanChangeId,
    subscriptionId: row.subscriptionId,
    targetPlanSnapshot: mapTargetPlanSnapshot(row.targetPlanSnapshot),
  };
}

function selectPendingPlanChangeFields() {
  return {
    direction: pendingPlanChangeTable.direction,
    effectiveAt: pendingPlanChangeTable.effectiveAt,
    id: pendingPlanChangeTable.id,
    membershipTargetId: pendingPlanChangeTable.membershipTargetId,
    membershipTargetType: pendingPlanChangeTable.membershipTargetType,
    providerConfirmedPlanChangeId:
      pendingPlanChangeTable.providerConfirmedPlanChangeId,
    subscriptionId: pendingPlanChangeTable.subscriptionId,
    targetPlanSnapshot: pendingPlanChangeTable.targetPlanSnapshot,
  };
}

function createPlanChangeStore(options: {
  auth: AuthenticatedUser;
  provider: PaymentProviderAdapter;
}): PlanChangeStore {
  return {
    async cancelPendingPlanChange(subscriptionId) {
      const [deletedPendingPlanChange] = await db
        .delete(pendingPlanChangeTable)
        .where(
          and(
            eq(pendingPlanChangeTable.subscriptionId, subscriptionId),
            eq(pendingPlanChangeTable.status, "pending")
          )
        )
        .returning(selectPendingPlanChangeFields());

      return deletedPendingPlanChange
        ? mapPendingPlanChangeRecord(deletedPendingPlanChange)
        : null;
    },
    async clearPendingPlanChange(subscriptionId) {
      const [deletedPendingPlanChange] = await db
        .delete(pendingPlanChangeTable)
        .where(
          and(
            eq(pendingPlanChangeTable.subscriptionId, subscriptionId),
            eq(pendingPlanChangeTable.status, "pending")
          )
        )
        .returning(selectPendingPlanChangeFields());

      return deletedPendingPlanChange
        ? mapPendingPlanChangeRecord(deletedPendingPlanChange)
        : null;
    },
    async findCurrentSubscription(input) {
      let subscriptions = await options.provider.listSubscriptions({
        customerEmail: options.auth.user.email,
        customerId: options.auth.user.id,
        limit: 100,
      });

      if (subscriptions.length === 0) {
        subscriptions = await discoverSubscriptionsFromDb(
          options.auth.user.id,
          options.provider
        );
      }

      const currentSubscription = subscriptions
        .filter(isCurrentSubscription)
        .find((subscription) =>
          subscriptionMatchesTarget(subscription, input.membershipTarget)
        );
      if (!currentSubscription) {
        return null;
      }

      return {
        id: currentSubscription.id,
        paymentProvider: options.provider.provider,
        paymentIntegrationId: readString(
          currentSubscription.metadata,
          "providerIntegrationId"
        ),
        organizationId: readMembershipTargetId(
          currentSubscription,
          "organization"
        ),
        subscriptionOwnerUserId: readMembershipTargetId(
          currentSubscription,
          "user"
        ),
      };
    },
    async findPendingPlanChange(subscriptionId) {
      const [pendingPlanChange] = await db
        .select(selectPendingPlanChangeFields())
        .from(pendingPlanChangeTable)
        .where(
          and(
            eq(pendingPlanChangeTable.subscriptionId, subscriptionId),
            eq(pendingPlanChangeTable.status, "pending")
          )
        )
        .limit(1);

      return pendingPlanChange
        ? mapPendingPlanChangeRecord(pendingPlanChange)
        : null;
    },
    async isBillingManager(input) {
      const [membership] = await db
        .select({
          billingManagedByRole: organizationTable.billingManagedByRole,
          memberRole: memberTable.role,
        })
        .from(memberTable)
        .innerJoin(
          organizationTable,
          eq(memberTable.organizationId, organizationTable.id)
        )
        .where(
          and(
            eq(memberTable.userId, input.actorUserId),
            eq(memberTable.organizationId, input.organizationId)
          )
        )
        .limit(1);

      if (!membership) {
        return false;
      }

      return roleListIncludes(
        membership.memberRole,
        membership.billingManagedByRole ?? DEFAULT_BILLING_MANAGER_ROLE
      );
    },
    listActiveVisiblePricingCatalogPlans() {
      return Promise.resolve([]);
    },
    moveMembershipToPlan() {
      return Promise.resolve();
    },
    savePendingPlanChange() {
      throw new Error("Pending Plan change cancellation cannot save state");
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
    message:
      error instanceof Error
        ? error.message
        : "Failed to cancel Pending Plan change",
  });
}

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);

  try {
    const body = planChangePendingCancellationSchema.parse(
      (await readBody(event)) ?? {}
    );
    const provider = await ensurePaymentProvider();
    const paymentIntegrationId = resolvePaymentIntegrationId(provider.provider);
    const membershipTarget = resolveMembershipTarget(auth, body);
    const cancellation = await cancelPendingPlanChange({
      actor: {
        email: auth.user.email,
        isAppAdmin: isAppAdmin(auth),
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
