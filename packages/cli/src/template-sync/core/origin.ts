import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"

const ORIGIN_FILE = ".beztack/origin.json"

export interface OriginFileEntry {
	projectHash: string
	templateHash: string
}

export interface Origin {
	createdAt: string
	files: Record<string, OriginFileEntry>
}

export function hashContent(content: string | Buffer): string {
	if (typeof content === "string") {
		return createHash("sha256").update(content, "utf-8").digest("hex")
	}

	return createHash("sha256").update(content).digest("hex")
}

export async function readOrigin(
	workspaceRoot: string,
): Promise<Origin | null> {
	try {
		const raw = await readFile(
			join(workspaceRoot, ORIGIN_FILE),
			"utf-8",
		)
		const parsed = JSON.parse(raw) as Partial<Origin>
		if (
			typeof parsed.createdAt !== "string" ||
			typeof parsed.files !== "object" ||
			parsed.files === null
		) {
			return null
		}
		return parsed as Origin
	} catch {
		return null
	}
}

export async function writeOrigin(
	workspaceRoot: string,
	origin: Origin,
): Promise<void> {
	const filePath = join(workspaceRoot, ORIGIN_FILE)
	await mkdir(dirname(filePath), { recursive: true })
	await writeFile(
		filePath,
		`${JSON.stringify(origin, null, 2)}\n`,
		"utf-8",
	)
}
