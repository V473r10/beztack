/**
 * POST /api/admin/plans/sync — Sync a single plan between DB and provider
 */

import { db, plan } from "@beztack/db";
import type { BillingInterval } from "@beztack/payments";
import { eq } from "drizzle-orm";
import { createError, defineEventHandler, readBody } from "h3";
import { z } from "zod";
import { ensurePaymentProvider } from "@/lib/payments";
import { requireAdmin } from "@/server/utils/require-auth";

const syncSchema = z.object({
  planId: z.string().min(1),
  direction: z.enum(["push-to-provider", "pull-from-provider"]),
});

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const adapter = await ensurePaymentProvider();

  const rawBody = await readBody(event);
  const body = syncSchema.parse(rawBody);

  const [dbPlan] = await db
    .select()
    .from(plan)
    .where(eq(plan.id, body.planId))
    .limit(1);

  if (body.direction === "push-to-provider") {
    if (!dbPlan) {
      throw createError({ statusCode: 404, message: "Plan not found" });
    }

    if (dbPlan.providerPlanId) {
      await adapter.updateProduct(dbPlan.providerPlanId, {
        name: dbPlan.displayName,
        description: dbPlan.description ?? undefined,
        price: { amount: Number(dbPlan.price), currency: dbPlan.currency },
        interval: (dbPlan.interval ?? "month") as BillingInterval,
        intervalCount: dbPlan.intervalCount ?? 1,
      });
    } else {
      const remoteProduct = await adapter.createProduct({
        name: dbPlan.displayName,
        description: dbPlan.description ?? undefined,
        type: "plan",
        price: { amount: Number(dbPlan.price), currency: dbPlan.currency },
        interval: (dbPlan.interval ?? "month") as BillingInterval,
        intervalCount: dbPlan.intervalCount ?? 1,
      });

      await db
        .update(plan)
        .set({ providerPlanId: remoteProduct.id })
        .where(eq(plan.id, body.planId));
    }

    return { success: true, direction: "push-to-provider" as const };
  }

  // pull-from-provider
  if (!dbPlan?.providerPlanId) {
    throw createError({
      statusCode: 400,
      message: "Plan has no linked provider product",
    });
  }

  const remoteProduct = await adapter.getProduct(dbPlan.providerPlanId);

  if (!remoteProduct) {
    throw createError({
      statusCode: 404,
      message: "Remote product not found",
    });
  }

  await db
    .update(plan)
    .set({
      displayName: remoteProduct.name,
      description: remoteProduct.description ?? null,
      price: String(remoteProduct.price.amount),
      currency: remoteProduct.price.currency,
      interval: remoteProduct.interval,
      intervalCount: remoteProduct.intervalCount,
    })
    .where(eq(plan.id, body.planId));

  return { success: true, direction: "pull-from-provider" as const };
});
