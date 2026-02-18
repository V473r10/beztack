import { runApply } from "./commands/apply.js"
import { runPlan } from "./commands/plan.js"
import { runRollback } from "./commands/rollback.js"
import { runStatus } from "./commands/status.js"
import { parseArgs } from "./core/args.js"

interface TemplateCommandOptions {
	workspaceRoot: string
	args: string[]
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
 *
 * The command can be specified with the --template-root flag to specify the template root.
 * The command can also be specified with the --to flag to specify the target version for the plan and apply commands.
 */
export async function runTemplateCommand(
	options: TemplateCommandOptions,
): Promise<void> {
	const parsed = parseArgs(options.args)
	const command = parsed.positional[0] ?? "status"
	const templateRoot =
		typeof parsed.flags["template-root"] === "string"
			? parsed.flags["template-root"]
			: undefined

	switch (command) {
		case "status":
			await runStatus({
				workspaceRoot: options.workspaceRoot,
				templateRoot,
			})
			return
		case "plan":
			await runPlan({
				workspaceRoot: options.workspaceRoot,
				templateRoot,
				toVersion:
					typeof parsed.flags.to === "string"
						? parsed.flags.to
						: undefined,
			})
			return
		case "apply":
			await runApply({
				workspaceRoot: options.workspaceRoot,
				args: options.args.slice(1),
			})
			return
		case "rollback":
			await runRollback({
				workspaceRoot: options.workspaceRoot,
				args: options.args.slice(1),
			})
			return
		default:
			throw new Error(
				`Unknown template command: ${command}. Use status|plan|apply|rollback.`,
			)
	}
}
