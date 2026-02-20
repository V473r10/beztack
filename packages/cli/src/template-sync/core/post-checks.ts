import { execFile } from "node:child_process"
import { constants } from "node:fs"
import { access, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

const TEMPLATE_REPOSITORY = "https://github.com/V473r10/beztack.git"
const TEMPLATE_BRANCH = "main"
const CACHE_META_FILE = "meta.json"
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

export async function ensureTemplateRoot(templateRoot: string): Promise<void> {
	await access(templateRoot, constants.R_OK)
}

export function getDefaultTemplateRoot(workspaceRoot: string): string {
	return join(workspaceRoot, ".beztack", "template-cache", "main")
}

interface ResolveTemplateRootInput {
	workspaceRoot: string
	templateRoot?: string
	refresh?: boolean
	offline?: boolean
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
	await syncRemoteTemplate(defaultTemplateRoot, {
		refresh: input.refresh === true,
		offline: input.offline === true,
	})
	return defaultTemplateRoot
}

/**
 * Syncs the remote template repository with the local template root.
 * If the local template root is not initialized, it will be initialized.
 * If the local template root is already initialized, it will be updated.
 * @param templateRoot - The path to the local template root.
 * @returns A promise that resolves when the syncing is complete.
 */
interface SyncRemoteTemplateOptions {
	refresh: boolean
	offline: boolean
}

interface TemplateCacheMetadata {
	lastFetchedAt: string
	lastCommit: string
	branch: string
	repository: string
}

async function syncRemoteTemplate(
	templateRoot: string,
	options: SyncRemoteTemplateOptions,
): Promise<void> {
	if (options.refresh && options.offline) {
		throw new Error("Cannot use --refresh together with --offline")
	}

	const gitDir = join(templateRoot, ".git")
	const hasTemplateRoot = await pathExists(templateRoot)
	const hasGitDir = await pathExists(gitDir)

	if (hasTemplateRoot && hasGitDir) {
		const shouldRefresh =
			options.refresh || (await isCacheStale(templateRoot))

		if (options.offline || !shouldRefresh) {
			return
		}

		try {
			await runGitCommand(
				[
					"fetch",
					"origin",
					TEMPLATE_BRANCH,
					"--depth",
					"1",
				],
				templateRoot,
			)
			await runGitCommand(
				[
					"reset",
					"--hard",
					`origin/${TEMPLATE_BRANCH}`,
				],
				templateRoot,
			)
			await updateCacheMetadata(templateRoot)
			return
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error)
			process.stderr.write(
				`Warning: failed to refresh template cache, using local cache: ${message}\n`,
			)
			return
		}
	}

	if (options.offline) {
		throw new Error(
			"Template cache is missing. Run once without --offline to initialize it.",
		)
	}

	if (hasTemplateRoot && !hasGitDir) {
		await rm(templateRoot, { recursive: true, force: true })
	}

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
	await updateCacheMetadata(templateRoot)
}

async function runGitCommand(
	args: string[],
	cwd?: string,
): Promise<string> {
	try {
		const result = cwd
			? await execFileAsync("git", args, { cwd })
			: await execFileAsync("git", args)
		return result.stdout.trim()
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

async function isCacheStale(templateRoot: string): Promise<boolean> {
	const meta = await readCacheMetadata(templateRoot)
	if (!meta) {
		return true
	}

	const lastFetchedAt = Date.parse(meta.lastFetchedAt)
	if (Number.isNaN(lastFetchedAt)) {
		return true
	}

	return Date.now() - lastFetchedAt >= CACHE_TTL_MS
}

function getCacheMetadataPath(templateRoot: string): string {
	return join(templateRoot, "..", CACHE_META_FILE)
}

async function readCacheMetadata(
	templateRoot: string,
): Promise<TemplateCacheMetadata | null> {
	const metadataPath = getCacheMetadataPath(templateRoot)
	try {
		const raw = await readFile(metadataPath, "utf-8")
		const parsed = JSON.parse(raw) as Partial<TemplateCacheMetadata>
		if (
			typeof parsed.lastFetchedAt !== "string" ||
			typeof parsed.lastCommit !== "string" ||
			typeof parsed.branch !== "string" ||
			typeof parsed.repository !== "string"
		) {
			return null
		}
		return {
			lastFetchedAt: parsed.lastFetchedAt,
			lastCommit: parsed.lastCommit,
			branch: parsed.branch,
			repository: parsed.repository,
		}
	} catch {
		return null
	}
}

async function updateCacheMetadata(templateRoot: string): Promise<void> {
	const lastCommit = await runGitCommand(["rev-parse", "HEAD"], templateRoot)
	const metadataPath = getCacheMetadataPath(templateRoot)
	const metadata: TemplateCacheMetadata = {
		lastFetchedAt: new Date().toISOString(),
		lastCommit,
		branch: TEMPLATE_BRANCH,
		repository: TEMPLATE_REPOSITORY,
	}
	await writeFile(
		metadataPath,
		`${JSON.stringify(metadata, null, 2)}\n`,
		"utf-8",
	)
}
