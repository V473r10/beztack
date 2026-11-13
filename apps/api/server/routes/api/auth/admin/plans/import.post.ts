/**
 * POST /api/auth/admin/plans/import — Import a remote provider product into the DB
 */
import { randomUUID } from "node:crypto";
import { db, plan } from "@beztack/db";
import { createError, defineEventHandler, readBody } from "h3";
import { z } from "zod";
import { ensurePaymentProvider } from "@/lib/payments";
import { invalidateProductsCache } from "@/server/utils/products-cache";
import { requireAdmin } from "@/server/utils/require-auth";

const importSchema = z.object({
  remoteProductId: z.string().min(1),
  canonicalTierId: z.string().optional(),
  displayOrder: z.number().optional(),
});

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const adapter = await ensurePaymentProvider();

  const rawBody = await readBody(event);
  const body = importSchema.parse(rawBody);

  const remoteProduct = await adapter.getProduct(body.remoteProductId);

  if (!remoteProduct) {
    throw createError({
      statusCode: 404,
      message: "Remote product not found",
    });
  }

  const planId = randomUUID();

  const [newPlan] = await db
    .insert(plan)
    .values({
      id: planId,
      provider: adapter.provider,
      providerPlanId: remoteProduct.id,
      canonicalTierId: body.canonicalTierId ?? "custom",
      displayName: remoteProduct.name,
      description: remoteProduct.description ?? null,
      price: remoteProduct.price.amount,
      currency: remoteProduct.price.currency,
      interval: remoteProduct.interval,
      intervalCount: remoteProduct.intervalCount,
      displayOrder: body.displayOrder ?? null,
      status: "active",
    })
    .returning();

  // The public Products response is built from these plans: drop its cache.
  invalidateProductsCache();

  return { plan: newPlan };
});
