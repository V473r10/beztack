/**
 * DELETE /api/admin/plans/:id — Soft-delete a plan and optionally remove from provider
 */
import { db, plan } from "@beztack/db";
import { eq } from "drizzle-orm";
import { createError, defineEventHandler } from "h3";
import { ensurePaymentProvider } from "@/lib/payments";
import { requireAdmin } from "@/server/utils/require-auth";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const planId = event.context.params?.id;
  if (!planId) {
    throw createError({ statusCode: 400, message: "Missing plan ID" });
  }

  const [dbPlan] = await db
    .select()
    .from(plan)
    .where(eq(plan.id, planId))
    .limit(1);

  if (!dbPlan) {
    throw createError({ statusCode: 404, message: "Plan not found" });
  }

  if (dbPlan.providerPlanId) {
    try {
      const adapter = await ensurePaymentProvider();
      await adapter.deleteProduct(dbPlan.providerPlanId);
    } catch (error) {
      // Log but do not fail — the local soft-delete should still proceed
      // biome-ignore lint/suspicious/noConsole: Logging provider deletion error for debugging
      console.error(
        `Failed to delete remote product ${dbPlan.providerPlanId}:`,
        error
      );
    }
  }

  const [updated] = await db
    .update(plan)
    .set({ status: "inactive" })
    .where(eq(plan.id, planId))
    .returning();

  return { plan: updated };
});
