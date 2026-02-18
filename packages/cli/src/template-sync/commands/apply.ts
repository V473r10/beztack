import pc from "picocolors"
import { applyUpdatePlan } from "../core/apply-update.js"
import { parseArgs } from "../core/args.js"
import { readManifest, writeManifest } from "../core/manifest.js"
import { buildUpdatePlan } from "../core/planner.js"
import {
	ensureTemplateRoot,
	resolveTemplateRoot,
} from "../core/post-checks.js"
import { writePlanReport } from "../core/report.js"
import { createSnapshot, rollbackSnapshot } from "../core/snapshot.js"
import { readTemplateVersion } from "../core/template-version.js"

interface ApplyOptions {
	workspaceRoot: string
	args: string[]
}

export async function runApply(options: ApplyOptions): Promise<void> {
	const parsed = parseArgs(options.args)
	const dryRun = parsed.flags["dry-run"] === true
	const requestedTemplateRoot =
		typeof parsed.flags["template-root"] === "string"
			? parsed.flags["template-root"]
			: undefined
	const requestedVersion =
		typeof parsed.flags.to === "string" ? parsed.flags.to : undefined

	const templateRoot = await resolveTemplateRoot({
		workspaceRoot: options.workspaceRoot,
		templateRoot: requestedTemplateRoot,
	})
	await ensureTemplateRoot(templateRoot)

	const manifest = await readManifest(options.workspaceRoot)
	const detectedTemplateVersion = await readTemplateVersion(templateRoot)
	const targetVersion = requestedVersion ?? detectedTemplateVersion
	const plan = await buildUpdatePlan({
		workspaceRoot: options.workspaceRoot,
		templateRoot,
		manifest,
	})
	const reportPath = await writePlanReport(options.workspaceRoot, plan)

	const snapshotId = dryRun
		? "dry-run"
		: await createSnapshot(options.workspaceRoot)

	try {
		const result = await applyUpdatePlan({
			workspaceRoot: options.workspaceRoot,
			plan,
			dryRun,
		})

		if (!dryRun) {
			await writeManifest(options.workspaceRoot, {
				...manifest,
				currentVersion: targetVersion,
				lastAppliedAt: new Date().toISOString(),
				appliedMigrations: [
					...manifest.appliedMigrations,
					`${manifest.currentVersion}->${targetVersion}`,
				],
			})
		}

		process.stdout.write(
			`${pc.bold("Template apply finished")}\n` +
				`- Dry run: ${dryRun ? "yes" : "no"}\n` +
				`- Snapshot: ${snapshotId}\n` +
				`- Applied: ${result.applied}\n` +
				`- Skipped: ${result.skipped}\n` +
				`- Conflicts: ${result.conflicts.length}\n` +
				`- Report: ${reportPath}\n`,
		)
	} catch (error) {
		if (!dryRun) {
			await rollbackSnapshot(options.workspaceRoot, snapshotId)
		}
		throw error
	}
}
