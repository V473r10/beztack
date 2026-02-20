import { runApply } from "./commands/apply.js"
import { runInspect } from "./commands/inspect.js"
import { runPlan } from "./commands/plan.js"
import { runRollback } from "./commands/rollback.js"
import { runStatus } from "./commands/status.js"
import { parseArgs, type ParsedArgs } from "./core/args.js"

interface TemplateCommandOptions {
	workspaceRoot: string
	args: string[]
}

interface ParsedTemplateCommandOptions {
	workspaceRoot: string
	parsed: ParsedArgs
	refresh: boolean
	offline: boolean
}

/**
 * Runs a Beztack template command.
 * @param {TemplateCommandOptions} options - The options for running the command.
 * @returns {Promise<void>} - A promise that resolves when the command is complete.
 *
 * Supported commands:
 * - status: Shows the status of the Beztack template in the given workspace.
 * - plan: Creates a plan for updating the Beztack template in the given workspace.
 * - apply: Applies the plan for updating the Beztack template in the given workspace.
 * - rollback: Rolls back the last applied update plan for the Beztack template in the given workspace.
 * - inspect: Opens an interactive local viewer for template changes.
 *
 * The command can be specified with the --template-root flag to specify the template root.
 * The command can also be specified with the --to flag to specify the target version for the plan and apply commands.
 */
export async function runTemplateCommand(
	options: TemplateCommandOptions,
): Promise<void> {
	const parsed = parseArgs(options.args)
	const command = parsed.positional[0] ?? "status"
	const refresh = parsed.flags.refresh === true
	const offline = parsed.flags.offline === true
	const templateRoot =
		typeof parsed.flags["template-root"] === "string"
			? parsed.flags["template-root"]
			: undefined

	const commandOptions: ParsedTemplateCommandOptions = {
		workspaceRoot: options.workspaceRoot,
		parsed,
		refresh,
		offline,
	}

	switch (command) {
		case "status":
			await runStatus({
				workspaceRoot: commandOptions.workspaceRoot,
				templateRoot,
				refresh: commandOptions.refresh,
				offline: commandOptions.offline,
			})
			return
		case "plan":
			await runPlan({
				workspaceRoot: commandOptions.workspaceRoot,
				templateRoot,
				toVersion:
					typeof parsed.flags.to === "string"
						? parsed.flags.to
						: undefined,
				refresh: commandOptions.refresh,
				offline: commandOptions.offline,
			})
			return
		case "apply":
			await runApply({
				workspaceRoot: commandOptions.workspaceRoot,
				parsed: commandOptions.parsed,
				refresh: commandOptions.refresh,
				offline: commandOptions.offline,
			})
			return
		case "rollback":
			await runRollback({
				workspaceRoot: commandOptions.workspaceRoot,
				parsed: commandOptions.parsed,
			})
			return
		case "inspect":
			await runInspect({
				workspaceRoot: commandOptions.workspaceRoot,
				templateRoot,
				refresh: commandOptions.refresh,
				offline: commandOptions.offline,
				host:
					typeof parsed.flags.host === "string"
						? parsed.flags.host
						: undefined,
				port:
					typeof parsed.flags.port === "string"
						? Number(parsed.flags.port)
						: undefined,
			})
			return
		default:
			throw new Error(
				`Unknown template command: ${command}. Use status|plan|apply|rollback|inspect.`,
			)
	}
}
