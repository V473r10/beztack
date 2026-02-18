import { execFile } from "node:child_process"
import { constants } from "node:fs"
import { access, mkdir, stat } from "node:fs/promises"
import { join } from "node:path"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

const TEMPLATE_REPOSITORY = "https://github.com/V473r10/beztack.git"
const TEMPLATE_BRANCH = "main"

export async function ensureTemplateRoot(templateRoot: string): Promise<void> {
	await access(templateRoot, constants.R_OK)
}

export function getDefaultTemplateRoot(workspaceRoot: string): string {
	return join(workspaceRoot, ".beztack", "template-cache", "main")
}

interface ResolveTemplateRootInput {
	workspaceRoot: string
	templateRoot?: string
}


/**
 * Resolves the template root from the given input.
 * If the template root is specified, it will be returned as is.
 * If the template root is not specified, the default template root will be used.
 * The default template root is a hidden directory inside the workspace root.
 * The default template root will be synced with the remote template repository.
 * @param {ResolveTemplateRootInput} input - The input for resolving the template root.
 * @returns {Promise<string>} - The resolved template root.
 */
export async function resolveTemplateRoot(
	input: ResolveTemplateRootInput,
): Promise<string> {
	if (typeof input.templateRoot === "string") {
		return input.templateRoot
	}

	const defaultTemplateRoot = getDefaultTemplateRoot(input.workspaceRoot)
	await syncRemoteTemplate(defaultTemplateRoot)
	return defaultTemplateRoot
}

/**
 * Syncs the remote template repository with the local template root.
 * If the local template root is not initialized, it will be initialized.
 * If the local template root is already initialized, it will be updated.
 * @param templateRoot - The path to the local template root.
 * @returns A promise that resolves when the syncing is complete.
 */
async function syncRemoteTemplate(templateRoot: string): Promise<void> {
	const gitDir = join(templateRoot, ".git")
	// if (await pathExists(gitDir)) {
	// 	await runGitCommand([
	// 		"-C",
	// 		templateRoot,
	// 		"fetch",
	// 		"origin",
	// 		TEMPLATE_BRANCH,
	// 		"--depth",
	// 		"1",
	// 	])
	// 	await runGitCommand([
	// 		"-C",
	// 		templateRoot,
	// 		"reset",
	// 		"--hard",
	// 		`origin/${TEMPLATE_BRANCH}`,
	// 	])
	// 	return
	// }

	await mkdir(join(templateRoot, ".."), { recursive: true })
	await runGitCommand([
		"clone",
		"--depth",
		"1",
		"--branch",
		TEMPLATE_BRANCH,
		TEMPLATE_REPOSITORY,
		templateRoot,
	])
}

async function runGitCommand(args: string[]): Promise<void> {
	try {
		await execFileAsync("git", args)
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Unknown git error"
		throw new Error(`Failed to sync Beztack template from main: ${message}`)
	}
}

async function pathExists(path: string): Promise<boolean> {
	try {
		const stats = await stat(path)
		return stats.isDirectory()
	} catch {
		return false
	}
}
