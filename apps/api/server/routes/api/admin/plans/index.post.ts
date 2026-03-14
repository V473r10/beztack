/**
 * POST /api/admin/plans — Create a new plan in both DB and payment provider
 */
import { randomUUID } from "node:crypto";
import { db, plan } from "@beztack/db";
import type { BillingInterval } from "@beztack/payments";
import { defineEventHandler, readBody } from "h3";
import { z } from "zod";
import { ensurePaymentProvider } from "@/lib/payments";
import { requireAdmin } from "@/server/utils/require-auth";

const createSchema = z.object({
  displayName: z.string().min(1),
  description: z.string().nullable().optional(),
  canonicalTierId: z.string().default("custom"),
  price: z.number().positive(),
  currency: z.string().default("USD"),
  interval: z.string().default("month"),
  intervalCount: z.number().int().positive().default(1),
  features: z.array(z.string()).optional(),
  limits: z.record(z.number()).optional(),
  permissions: z.array(z.string()).optional(),
  displayOrder: z.number().nullable().optional(),
  highlighted: z.boolean().optional(),
  visible: z.boolean().optional(),
});

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const adapter = await ensurePaymentProvider();

  const rawBody = await readBody(event);
  const data = createSchema.parse(rawBody);

  const remoteProduct = await adapter.createProduct({
    name: data.displayName,
    description: data.description ?? undefined,
    type: "plan",
    price: { amount: data.price, currency: data.currency },
    interval: data.interval as BillingInterval,
    intervalCount: data.intervalCount,
  });

  const planId = randomUUID();

  const [newPlan] = await db
    .insert(plan)
    .values({
      id: planId,
      provider: adapter.provider,
      providerPlanId: remoteProduct.id,
      canonicalTierId: data.canonicalTierId,
      displayName: data.displayName,
      description: data.description ?? null,
      price: String(data.price),
      currency: data.currency,
      interval: data.interval,
      intervalCount: data.intervalCount,
      features: data.features ?? [],
      limits: data.limits ?? {},
      permissions: data.permissions ?? [],
      displayOrder: data.displayOrder ?? null,
      highlighted: data.highlighted ?? false,
      visible: data.visible ?? true,
      status: "active",
    })
    .returning();

  return { plan: newPlan, syncStatus: "synced" };
});
