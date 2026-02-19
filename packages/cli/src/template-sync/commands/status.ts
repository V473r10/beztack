import pc from "picocolors"
import { readManifest } from "../core/manifest.js"
import { buildUpdatePlan } from "../core/planner.js"
import {
	ensureTemplateRoot,
	resolveTemplateRoot,
} from "../core/post-checks.js"
import { writePlanReport } from "../core/report.js"
import { readTemplateVersion } from "../core/template-version.js"

interface StatusOptions {
	workspaceRoot: string
	templateRoot?: string
	refresh: boolean
	offline: boolean
}

/**
 * Runs a status check for the template in the given workspace root.
 * If the template root is not specified, it will be resolved from the manifest.
 * If the template root does not exist, it will be reported as unavailable and
 * a hint will be provided to generate or point to a template root.
 * The status check will print the template ID, current version, target version,
 * pending changes, conflicts, and report path.
 * @param {StatusOptions} options - The options for running the status check.
 * @returns {Promise<void>} A promise that resolves when the status check is complete.
 */
export async function runStatus(options: StatusOptions): Promise<void> {
	const templateRoot = await resolveTemplateRoot({
		workspaceRoot: options.workspaceRoot,
		templateRoot: options.templateRoot,
		refresh: options.refresh,
		offline: options.offline,
	})
	const manifest = await readManifest(options.workspaceRoot)

	try {
		await ensureTemplateRoot(templateRoot)
	} catch (error) {
		if (!isMissingTemplateRootError(error)) {
			throw error
		}

		process.stdout.write(
			`${pc.bold("Template status")}\n` +
				`- Template ID: ${manifest.templateId}\n` +
				`- Current version: ${manifest.currentVersion}\n` +
				`- Target version: unavailable\n` +
				`- Pending changes: unavailable\n` +
				`- Conflicts: unavailable\n` +
				`- Template root: ${templateRoot}\n` +
				`- Hint: generate or point to a template root with --template-root\n`,
		)
		return
	}

	const targetVersion = await readTemplateVersion(templateRoot)
	const plan = await buildUpdatePlan({
		workspaceRoot: options.workspaceRoot,
		templateRoot,
		manifest,
	})
	const reportPath = await writePlanReport(options.workspaceRoot, plan)

	process.stdout.write(
		`${pc.bold("Template status")}\n` +
			`- Template ID: ${manifest.templateId}\n` +
			`- Current version: ${manifest.currentVersion}\n` +
			`- Target version: ${targetVersion}\n` +
			`- Pending changes: ${plan.changes.length}\n` +
			`- Skipped unchanged template files: ${plan.skippedUnchangedTemplateFiles}\n` +
			`- Conflicts: ${plan.conflicts.length}\n` +
			`- Report: ${reportPath}\n`,
	)
}

function isMissingTemplateRootError(error: unknown): boolean {
	if (typeof error !== "object" || error === null || !("code" in error)) {
		return false
	}

	return error.code === "ENOENT"
}
