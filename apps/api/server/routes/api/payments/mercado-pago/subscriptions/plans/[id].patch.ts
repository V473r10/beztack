import { eq } from "drizzle-orm"
import { createError, defineEventHandler, getRouterParam, readBody } from "h3"
import { z } from "zod"
import { db, mpPlan } from "@beztack/db"
import { requireAdmin } from "@/server/utils/require-auth"

const updatePlanSchema = z.object({
	canonicalTierId: z
		.enum(["free", "basic", "pro", "ultimate"])
		.nullable()
		.optional(),
	displayName: z.string().min(1).optional(),
	description: z.string().nullable().optional(),
	features: z.array(z.string()).nullable().optional(),
	limits: z.record(z.string(), z.number()).nullable().optional(),
	permissions: z.array(z.string()).nullable().optional(),
	displayOrder: z.number().int().nullable().optional(),
	highlighted: z.boolean().optional(),
	visible: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
	await requireAdmin(event)

	const planId = getRouterParam(event, "id")
	if (!planId) {
		throw createError({
			statusCode: 400,
			message: "Plan ID is required",
		})
	}

	const body = await readBody(event)
	const parsed = updatePlanSchema.parse(body)

	if (Object.keys(parsed).length === 0) {
		throw createError({
			statusCode: 400,
			message: "At least one field is required",
		})
	}

	const [existing] = await db
		.select({ id: mpPlan.id })
		.from(mpPlan)
		.where(eq(mpPlan.id, planId))
		.limit(1)

	if (!existing) {
		throw createError({
			statusCode: 404,
			message: `Plan ${planId} not found`,
		})
	}

	const [updated] = await db
		.update(mpPlan)
		.set(parsed)
		.where(eq(mpPlan.id, planId))
		.returning()

	return { success: true, plan: updated }
})
