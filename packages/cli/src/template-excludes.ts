const TEMPLATE_EXCLUDED_DIRS = [
	".git",
	"node_modules",
	"scripts/create-beztack",
	".github",
	".nx",
	"docs",
] as const

/**
 * Directories intentionally excluded from scaffolded repositories.
 */
export const templateExcludedDirs = [...TEMPLATE_EXCLUDED_DIRS]

export function isTemplateExcludedPath(relativePath: string): boolean {
	if (relativePath.length === 0) {
		return false
	}

	const normalizedPath = relativePath.replaceAll("\\", "/")

	for (const dir of TEMPLATE_EXCLUDED_DIRS) {
		if (
			normalizedPath === dir ||
			normalizedPath.startsWith(`${dir}/`)
		) {
			return true
		}
	}

	return false
}
