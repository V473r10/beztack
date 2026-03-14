/**
 * GET /api/admin/plans/sync-status — Compare DB plans with remote provider products
 */
import { db, plan } from "@beztack/db";
import { defineEventHandler } from "h3";
import { ensurePaymentProvider } from "@/lib/payments";
import { buildSyncView } from "@/lib/payments/sync";
import { requireAdmin } from "@/server/utils/require-auth";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const adapter = await ensurePaymentProvider();

  const [dbPlans, remoteProducts] = await Promise.all([
    db.select().from(plan).orderBy(plan.displayOrder),
    adapter.listProducts(),
  ]);

  const syncView = buildSyncView(dbPlans, remoteProducts);

  return { plans: syncView, provider: adapter.provider };
});
