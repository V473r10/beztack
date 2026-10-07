/**
 * GET /api/subscriptions/plan-change/pending
 *
 * The Membership target's Pending Plan change, so a Billing manager sees what
 * changes at renewal and when. `null` when nothing is pending.
 */
import { createError, defineEventHandler, getQuery } from "h3";
import { env } from "@/env";
import { requireAuth } from "@/server/utils/membership";
import { requireOrganizationBillingManagerAccess } from "@/server/utils/organization-access";
import { findPendingPlanChangeForMembershipTarget } from "@/server/utils/pending-plan-change-ledger";

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);
  const query = getQuery(event);

  let membershipTarget: { type: "user" | "organization"; id: string };
  if (env.SUBSCRIPTION_MODE === "organization") {
    const organizationId =
      (typeof query.organizationId === "string" && query.organizationId) ||
      auth.session.activeOrganizationId;
    if (!organizationId) {
      throw createError({
        statusCode: 400,
        message: "An organization Membership target is required",
      });
    }
    await requireOrganizationBillingManagerAccess(auth, organizationId);
    membershipTarget = { type: "organization", id: organizationId };
  } else {
    membershipTarget = { type: "user", id: auth.user.id };
  }

  const pendingPlanChange = await findPendingPlanChangeForMembershipTarget(membershipTarget);
  if (!pendingPlanChange) {
    return { pendingPlanChange: null };
  }

  const target = pendingPlanChange.targetPlanSnapshot;
  return {
    pendingPlanChange: {
      id: pendingPlanChange.id,
      direction: pendingPlanChange.direction,
      effectiveAt: pendingPlanChange.effectiveAt?.toISOString() ?? null,
      subscriptionId: pendingPlanChange.subscriptionId,
      targetPlan: {
        id: target.id,
        tierId: target.canonicalTierId,
        billingCadence: target.billingCadence,
        price: target.price,
      },
    },
  };
});
