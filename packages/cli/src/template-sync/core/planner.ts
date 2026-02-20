import type { TemplateManifest, UpdatePlan } from "./types.js"
import { computeDiff } from "./diff.js"
import { resolveOwnership } from "./ownership.js"

interface BuildPlanInput {
	workspaceRoot: string
	templateRoot: string
	manifest: TemplateManifest
}

export async function buildUpdatePlan(
	input: BuildPlanInput,
): Promise<UpdatePlan> {
	const diffResult = await computeDiff(
		input.workspaceRoot,
		input.templateRoot,
	)
	const changes = diffResult.changes.map((change) => {
		const ownership = resolveOwnership(
			change.path,
			input.manifest.strategyByPath,
		)

		let conflictReason: string | undefined
		if (ownership === "custom-owned") {
			conflictReason = "custom-owned path must be reviewed manually"
		}

		return {
			...change,
			ownership,
			conflictReason,
		}
	})

	const conflicts = changes.filter((change) =>
		typeof change.conflictReason === "string",
	)

	return {
		changes,
		conflicts,
		skippedUnchangedTemplateFiles: diffResult.skippedUnchangedTemplateFiles,
	}
}
