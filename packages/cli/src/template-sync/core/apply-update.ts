import { mkdir, rm, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import type { UpdatePlan } from "./types.js"
import { mergeWithProtectedZones } from "./zone-merger.js"

interface ApplyInput {
	workspaceRoot: string
	plan: UpdatePlan
	dryRun: boolean
}

export interface ApplyResult {
	applied: number
	skipped: number
	conflicts: string[]
}

export async function applyUpdatePlan(input: ApplyInput): Promise<ApplyResult> {
	let applied = 0
	let skipped = 0
	const conflicts: string[] = []

	for (const change of input.plan.changes) {
		if (change.ownership === "custom-owned") {
			skipped += 1
			conflicts.push(`${change.path}: ${change.conflictReason}`)
			continue
		}

		if (change.type === "delete") {
			if (!input.dryRun) {
				await rm(join(input.workspaceRoot, change.path), { force: true })
			}
			applied += 1
			continue
		}

		const isBinary = change.isBinary === true
		const templateContent = change.templateContent ?? ""
		let output = templateContent

		if (!isBinary && change.ownership === "mixed") {
			const merged = mergeWithProtectedZones(
				change.currentContent ?? "",
				templateContent,
			)
			output = merged.content
			for (const conflict of merged.conflicts) {
				conflicts.push(`${change.path}: ${conflict}`)
			}
		}

		if (!input.dryRun) {
			const destination = join(input.workspaceRoot, change.path)
			await mkdir(dirname(destination), { recursive: true })
			if (isBinary) {
				await writeFile(
					destination,
					change.templateBinaryContent ?? Buffer.alloc(0),
				)
			} else {
				await writeFile(destination, output, "utf-8")
			}
		}

		applied += 1
	}

	return {
		applied,
		skipped,
		conflicts,
	}
}
