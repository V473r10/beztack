/**
 * PATCH /api/admin/plans/:id — Update a plan's catalog metadata
 */
import { db, plan } from "@beztack/db";
import { eq } from "drizzle-orm";
import { createError, defineEventHandler, readBody } from "h3";
import { z } from "zod";
import { ensurePaymentProvider } from "@/lib/payments";
import { requireAdmin } from "@/server/utils/require-auth";

const updateSchema = z.object({
  canonicalTierId: z.string().nullable().optional(),
  displayName: z.string().optional(),
  description: z.string().nullable().optional(),
  features: z.array(z.string()).optional(),
  limits: z.record(z.number()).optional(),
  permissions: z.array(z.string()).optional(),
  displayOrder: z.number().nullable().optional(),
  highlighted: z.boolean().optional(),
  visible: z.boolean().optional(),
});

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const planId = event.context.params?.id;
  if (!planId) {
    throw createError({ statusCode: 400, message: "Missing plan ID" });
  }

  const body = await readBody(event);
  const data = updateSchema.parse(body);

  const [existing] = await db
    .select()
    .from(plan)
    .where(eq(plan.id, planId))
    .limit(1);

  if (!existing) {
    throw createError({ statusCode: 404, message: "Plan not found" });
  }

  // If linked to a provider, check sync status before editing
  if (existing.providerPlanId) {
    const adapter = await ensurePaymentProvider();
    const remoteProduct = await adapter.getProduct(existing.providerPlanId);
    if (remoteProduct) {
      const { buildSyncView } = await import("@/lib/payments/sync");
      const [view] = buildSyncView([existing], [remoteProduct]);
      if (view && view.syncStatus === "out-of-sync") {
        throw createError({
          statusCode: 409,
          message:
            "Plan is out-of-sync with provider. Resolve sync conflict before editing.",
        });
      }
    }
  }

  const [updated] = await db
    .update(plan)
    .set(data)
    .where(eq(plan.id, planId))
    .returning();

  return { plan: updated };
});
