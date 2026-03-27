/**
 * GET /api/admin/plans — List all plans from the generic plan table
 */
import { db, plan } from "@beztack/db";
import { defineEventHandler } from "h3";
import { requireAdmin } from "@/server/utils/require-auth";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const plans = await db.select().from(plan).orderBy(plan.displayOrder);

  return {
    plans,
    total: plans.length,
  };
});
