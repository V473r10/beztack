import { readFile } from "node:fs/promises"
import { join } from "node:path"

const VERSION_FILE = "template.version"

export async function readTemplateVersion(templateRoot: string): Promise<string> {
	try {
		const raw = await readFile(join(templateRoot, VERSION_FILE), "utf-8")
		const value = raw.trim()
		if (value.length > 0) {
			return value
		}
		return "0.0.0"
	} catch {
		return "0.0.0"
	}
}
