import {
  db,
  member as memberTable,
  organization as organizationTable,
  plan as planTable,
} from "@beztack/db";
import type { PaymentProviderAdapter, Subscription } from "@beztack/payments";
import { and, eq } from "drizzle-orm";
import { createError, defineEventHandler, readBody } from "h3";
import { z } from "zod";
import { env } from "@/env";
import { ensurePaymentProvider } from "@/lib/payments";
import { type AuthenticatedUser, requireAuth } from "@/server/utils/membership";
import {
  type PlanChangeBillingCadence,
  PlanChangeError,
  type PlanChangeStore,
  previewPlanChange,
} from "@/server/utils/plan-change";
import { discoverSubscriptionsFromDb } from "@/server/utils/subscription-discovery";

const TIER_IDS = ["free", "basic", "pro", "ultimate"] as const;
const SINGLE_INTERVAL_COUNT = 1;
const MONTHS_PER_YEAR = 12;
const DEFAULT_BILLING_MANAGER_ROLE = "owner";

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

function getAppAdminEmails(): string[] {
  return env.APP_ADMIN_EMAILS.split(",")
    .map((email: string) => email.trim().toLowerCase())
    .filter(Boolean);
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

function hasAppAdminRole(role: string | string[] | null): boolean {
  return role?.includes("sudo") ?? false;
}

function isAppAdmin(auth: AuthenticatedUser): boolean {
  if (!hasAppAdminRole(getAuthRole(auth))) {
    return false;
  }

  return getAppAdminEmails().includes(auth.user.email.trim().toLowerCase());
}

function resolveMembershipTarget(
  auth: AuthenticatedUser,
  body: PlanChangePreviewRequest
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

function isCurrentSubscription(subscription: Subscription): boolean {
  if (subscription.status === "active") {
    return true;
  }

  return Boolean(
    subscription.status === "canceled" &&
      subscription.currentPeriodEnd &&
      subscription.currentPeriodEnd > new Date()
  );
}

function readString(
  source: Record<string, unknown> | undefined,
  key: string
): string | undefined {
  const value = source?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
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

function subscriptionMatchesMembershipTarget(
  subscription: Subscription,
  target: ReturnType<typeof resolveMembershipTarget>
): boolean {
  return readMembershipTargetId(subscription, target.type) === target.id;
}

function roleListIncludes(role: string | null, expectedRole: string): boolean {
  return (role ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .includes(expectedRole);
}

function mapPlanBillingCadence(input: {
  id: string;
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

function createPlanChangeStore(options: {
  auth: AuthenticatedUser;
  provider: PaymentProviderAdapter;
}): PlanChangeStore {
  return {
    cancelPendingPlanChange() {
      return Promise.resolve(null);
    },
    clearPendingPlanChange() {
      return Promise.resolve(null);
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
          subscriptionMatchesMembershipTarget(
            subscription,
            input.membershipTarget
          )
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
    findPendingPlanChange() {
      return Promise.resolve(null);
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

      const billingManagerRole =
        membership.billingManagedByRole ?? DEFAULT_BILLING_MANAGER_ROLE;
      return roleListIncludes(membership.memberRole, billingManagerRole);
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
    moveMembershipToPlan() {
      return Promise.resolve();
    },
    savePendingPlanChange(input) {
      return Promise.resolve({
        id: `pending_${input.subscriptionId}`,
        ...input,
      });
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
    message:
      error instanceof Error
        ? error.message
        : "Failed to create Plan change preview",
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

    const provider = await ensurePaymentProvider();
    const membershipTarget = resolveMembershipTarget(auth, body);
    const preview = await previewPlanChange({
      actor: {
        email: auth.user.email,
        isAppAdmin: isAppAdmin(auth),
        userId: auth.user.id,
      },
      membershipTarget,
      paymentProvider: provider.provider,
      paymentIntegrationId: resolvePaymentIntegrationId(provider.provider),
      target: {
        planId: body.targetPricingCatalogPlanId,
        tierId: body.targetTierId,
        billingCadence: body.targetBillingCadence,
      },
      store: createPlanChangeStore({ auth, provider }),
    });

    return {
      provider: provider.provider,
      planChangePreview: preview,
    };
  } catch (error) {
    rethrowPlanChangePreviewError(error);
  }
});
