/**
 * GET /api/auth/admin/plan-changes/failed
 *
 * Pending Plan changes whose activation kept failing, with the last error as
 * the reason, so an App admin can see and resolve them.
 */
import { defineEventHandler } from "h3";
import { listFailedPendingPlanChanges } from "@/server/utils/pending-plan-change-ledger";
import { requireAdmin } from "@/server/utils/require-auth";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const failedPlanChanges = await listFailedPendingPlanChanges();

  return {
    failedPlanChanges,
    total: failedPlanChanges.length,
  };
});
