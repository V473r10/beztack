import pc from "picocolors"
import { readManifest } from "../core/manifest.js"
import { buildUpdatePlan } from "../core/planner.js"
import {
	ensureTemplateRoot,
	resolveTemplateRoot,
} from "../core/post-checks.js"
import { writePlanReport } from "../core/report.js"
import { readTemplateVersion } from "../core/template-version.js"

interface PlanOptions {
	workspaceRoot: string
	templateRoot?: string
	toVersion?: string
}

export async function runPlan(options: PlanOptions): Promise<void> {
	const templateRoot = await resolveTemplateRoot({
		workspaceRoot: options.workspaceRoot,
		templateRoot: options.templateRoot,
	})
	await ensureTemplateRoot(templateRoot)

	console.log("Template root:", templateRoot)

	const manifest = await readManifest(options.workspaceRoot)
	const detectedVersion = await readTemplateVersion(templateRoot)
	const targetVersion = options.toVersion ?? detectedVersion

	console.log("Manifest:", manifest)
	console.log("Detected version:", detectedVersion)
	console.log("Target version:", targetVersion)

	const plan = await buildUpdatePlan({
		workspaceRoot: options.workspaceRoot,
		templateRoot,
		manifest,
	})
	const reportPath = await writePlanReport(options.workspaceRoot, plan)


	process.stdout.write(
		`${pc.bold("Template update plan")}\n` +
			`- From: ${manifest.currentVersion}\n` +
			`- To: ${targetVersion}\n` +
			`- Changes: ${plan.changes.length}\n` +
			`- Conflicts: ${plan.conflicts.length}\n` +
			`- Report: ${reportPath}\n`,
	)
}
