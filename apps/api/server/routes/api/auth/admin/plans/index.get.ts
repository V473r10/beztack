/**
 * GET /api/auth/admin/plans — List all plans from the generic plan table
 */
import { db, plan } from "@beztack/db";
import { defineEventHandler } from "h3";
import { withLegacyPlanPrice } from "@/server/utils/legacy-plan-price";
import { requireAdmin } from "@/server/utils/require-auth";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const rows = await db.select().from(plan).orderBy(plan.displayOrder);
  const plans = rows.map(withLegacyPlanPrice);

  return {
    plans,
    total: plans.length,
  };
});
