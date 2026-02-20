import type { ParsedArgs } from "../core/args.js"
import { clearSnapshots, rollbackSnapshot } from "../core/snapshot.js"

interface RollbackOptions {
	workspaceRoot: string
	parsed: ParsedArgs
}

export async function runRollback(options: RollbackOptions): Promise<void> {
	const snapshotId =
		typeof options.parsed.flags.snapshot === "string"
			? options.parsed.flags.snapshot
			: undefined

	if (!snapshotId) {
		throw new Error("Missing --snapshot <id> for rollback")
	}

	await rollbackSnapshot(options.workspaceRoot, snapshotId)
	if (options.parsed.flags["clear-snapshots"] === true) {
		await clearSnapshots(options.workspaceRoot)
	}

	process.stdout.write(
		`Rollback completed from snapshot ${snapshotId}\n`,
	)
}
