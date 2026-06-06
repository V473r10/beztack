import {
  db,
  member as memberTable,
  organization as organizationTable,
  pendingPlanChange as pendingPlanChangeTable,
  plan as planTable,
  user as userTable,
} from "@beztack/db";
import type { PaymentProviderAdapter, Subscription } from "@beztack/payments";
import { and, eq } from "drizzle-orm";
import { createError, defineEventHandler, readBody } from "h3";
import { z } from "zod";
import { env } from "@/env";
import { ensurePaymentProvider } from "@/lib/payments";
import { type AuthenticatedUser, requireAuth } from "@/server/utils/membership";
import {
  acceptPlanChange,
  type PendingPlanChangeRecord,
  type PlanChangeBillingCadence,
  type PlanChangeCatalogPlan,
  PlanChangeError,
  type PlanChangePaymentAdapter,
  type PlanChangeStore,
} from "@/server/utils/plan-change";
import { discoverSubscriptionsFromDb } from "@/server/utils/subscription-discovery";

const TIER_IDS = ["free", "basic", "pro", "ultimate"] as const;
const SINGLE_INTERVAL_COUNT = 1;
const MONTHS_PER_YEAR = 12;
const DEFAULT_BILLING_MANAGER_ROLE = "owner";

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

function resolveMembershipTarget(
  auth: AuthenticatedUser,
  body: PlanChangeAcceptRequest
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

function readBillingCadence(
  subscription: Subscription
): PlanChangeBillingCadence | undefined {
  const interval = readString(subscription.metadata, "billingInterval");
  const frequency = subscription.metadata?.billingFrequency;
  const intervalCount =
    typeof frequency === "number" ? frequency : SINGLE_INTERVAL_COUNT;

  if (interval === "month" && intervalCount === SINGLE_INTERVAL_COUNT) {
    return "monthly";
  }

  if (
    (interval === "year" && intervalCount === SINGLE_INTERVAL_COUNT) ||
    (interval === "month" && intervalCount === MONTHS_PER_YEAR)
  ) {
    return "yearly";
  }

  return;
}

function mapPlanBillingCadence(input: {
  interval: string | null;
  intervalCount: number | null;
}): PlanChangeBillingCadence | null {
  const interval = input.interval?.trim().toLowerCase();
  const intervalCount = input.intervalCount ?? SINGLE_INTERVAL_COUNT;

  if (interval === "month" && intervalCount === SINGLE_INTERVAL_COUNT) {
    return "monthly";
  }

  if (
    (interval === "year" && intervalCount === SINGLE_INTERVAL_COUNT) ||
    (interval === "month" && intervalCount === MONTHS_PER_YEAR)
  ) {
    return "yearly";
  }

  return null;
}

function roleListIncludes(role: string | null, expectedRole: string): boolean {
  return (role ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .includes(expectedRole);
}

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

function subscriptionMatchesTarget(
  subscription: Subscription,
  target: ReturnType<typeof resolveMembershipTarget>
): boolean {
  return readMembershipTargetId(subscription, target.type) === target.id;
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
        .returning({
          direction: pendingPlanChangeTable.direction,
          effectiveAt: pendingPlanChangeTable.effectiveAt,
          id: pendingPlanChangeTable.id,
          membershipTargetId: pendingPlanChangeTable.membershipTargetId,
          membershipTargetType: pendingPlanChangeTable.membershipTargetType,
          providerConfirmedPlanChangeId:
            pendingPlanChangeTable.providerConfirmedPlanChangeId,
          subscriptionId: pendingPlanChangeTable.subscriptionId,
          targetPlanSnapshot: pendingPlanChangeTable.targetPlanSnapshot,
        });

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
        .returning({
          direction: pendingPlanChangeTable.direction,
          effectiveAt: pendingPlanChangeTable.effectiveAt,
          id: pendingPlanChangeTable.id,
          membershipTargetId: pendingPlanChangeTable.membershipTargetId,
          membershipTargetType: pendingPlanChangeTable.membershipTargetType,
          providerConfirmedPlanChangeId:
            pendingPlanChangeTable.providerConfirmedPlanChangeId,
          subscriptionId: pendingPlanChangeTable.subscriptionId,
          targetPlanSnapshot: pendingPlanChangeTable.targetPlanSnapshot,
        });

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
        providerPlanId: currentSubscription.productId,
        canonicalTierId:
          readString(currentSubscription.metadata, "tier") ??
          readString(currentSubscription.metadata, "planId"),
        billingCadence: readBillingCadence(currentSubscription),
        organizationId: readMembershipTargetId(
          currentSubscription,
          "organization"
        ),
        subscriptionOwnerUserId: readMembershipTargetId(
          currentSubscription,
          "user"
        ),
        currentPeriodStart: currentSubscription.currentPeriodStart,
        currentPeriodEnd: currentSubscription.currentPeriodEnd,
      };
    },
    async findPendingPlanChange(subscriptionId) {
      const [pendingPlanChange] = await db
        .select({
          direction: pendingPlanChangeTable.direction,
          effectiveAt: pendingPlanChangeTable.effectiveAt,
          id: pendingPlanChangeTable.id,
          membershipTargetId: pendingPlanChangeTable.membershipTargetId,
          membershipTargetType: pendingPlanChangeTable.membershipTargetType,
          providerConfirmedPlanChangeId:
            pendingPlanChangeTable.providerConfirmedPlanChangeId,
          subscriptionId: pendingPlanChangeTable.subscriptionId,
          targetPlanSnapshot: pendingPlanChangeTable.targetPlanSnapshot,
        })
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
            eq(planTable.status, "active")
          )
        );

      return rows.flatMap((row) => {
        const billingCadence = mapPlanBillingCadence(row);
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

      await db
        .update(userTable)
        .set(updates)
        .where(eq(userTable.id, input.membershipTarget.id));
    },
    savePendingPlanChange(input) {
      const id = `pending_${input.subscriptionId}`;
      const values = {
        direction: input.direction,
        effectiveAt: input.effectiveAt,
        id,
        membershipTargetId: input.membershipTarget.id,
        membershipTargetType: input.membershipTarget.type,
        providerConfirmedPlanChangeId: input.providerConfirmedPlanChangeId,
        status: "pending",
        subscriptionId: input.subscriptionId,
        targetPlanSnapshot: input.targetPlanSnapshot,
        updatedAt: new Date(),
      };

      return db
        .insert(pendingPlanChangeTable)
        .values(values)
        .onConflictDoUpdate({
          set: values,
          target: pendingPlanChangeTable.subscriptionId,
        })
        .then(() => ({
          id,
          ...input,
        }));
    },
  };
}

function billingCadenceToInterval(cadence: PlanChangeBillingCadence) {
  return cadence === "yearly" ? "year" : "month";
}

function createPaymentAdapter(
  provider: PaymentProviderAdapter,
  paymentIntegrationId?: string
): PlanChangePaymentAdapter {
  return {
    paymentProvider: provider.provider,
    paymentIntegrationId,
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
        throw new Error(
          "Target Pricing catalog plan was not confirmed by provider"
        );
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
    message:
      error instanceof Error ? error.message : "Failed to accept Plan change",
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

    const provider = await ensurePaymentProvider();
    const paymentIntegrationId = resolvePaymentIntegrationId(provider.provider);
    const membershipTarget = resolveMembershipTarget(auth, body);
    const acceptance = await acceptPlanChange({
      actor: {
        email: auth.user.email,
        isAppAdmin: isAppAdmin(auth),
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
