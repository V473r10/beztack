/**
 * POST /api/auth/admin/plan-changes/:id/retry
 *
 * An App admin retries a `failed` Pending Plan change after fixing its cause.
 * It is activated now, the same way a renewal would (provider first, then the
 * Membership); a new failure leaves it `failed` with the new reason. The
 * answer is 200 either way, with `action` saying which happened.
 */
import { createError, defineEventHandler, getRouterParam } from "h3";
import { ensurePaymentProvider } from "@/lib/payments";
import { requireAuth } from "@/server/utils/membership";
import { createDbPendingPlanChangeLedger } from "@/server/utils/pending-plan-change-ledger";
import { createPendingPlanChangeProviderPort } from "@/server/utils/pending-plan-change-provider";
import { PlanChangeError, retryFailedPendingPlanChange } from "@/server/utils/plan-change";
import { requireAdmin } from "@/server/utils/require-auth";
import { createDbPendingPlanChangeActivationStore } from "@/server/utils/subscription-projection";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const auth = await requireAuth(event);

  const pendingPlanChangeId = getRouterParam(event, "id");
  if (!pendingPlanChangeId) {
    throw createError({ statusCode: 400, statusMessage: "Pending Plan change id is required" });
  }

  try {
    const activation = await retryFailedPendingPlanChange({
      actor: {
        email: auth.user.email,
        isAppAdmin: true,
        isBillingManager: false,
        userId: auth.user.id,
      },
      pendingPlanChangeId,
      provider: createPendingPlanChangeProviderPort(ensurePaymentProvider),
      store: {
        ...(await createDbPendingPlanChangeActivationStore()),
        requeueFailedPendingPlanChange:
          createDbPendingPlanChangeLedger().requeueFailedPendingPlanChange,
      },
    });

    return {
      action: activation.action,
      pendingPlanChange: activation.pendingPlanChange,
    };
  } catch (error) {
    if (error instanceof PlanChangeError) {
      throw createError({
        data: { code: error.code },
        statusCode: error.statusCode,
        statusMessage: error.statusMessage,
      });
    }
    throw error;
  }
});
