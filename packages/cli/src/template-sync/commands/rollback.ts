import { parseArgs } from "../core/args.js"
import { clearSnapshots, rollbackSnapshot } from "../core/snapshot.js"

interface RollbackOptions {
	workspaceRoot: string
	args: string[]
}

export async function runRollback(options: RollbackOptions): Promise<void> {
	const parsed = parseArgs(options.args)
	const snapshotId =
		typeof parsed.flags.snapshot === "string"
			? parsed.flags.snapshot
			: undefined

	if (!snapshotId) {
		throw new Error("Missing --snapshot <id> for rollback")
	}

	await rollbackSnapshot(options.workspaceRoot, snapshotId)
	if (parsed.flags["clear-snapshots"] === true) {
		await clearSnapshots(options.workspaceRoot)
	}

	process.stdout.write(
		`Rollback completed from snapshot ${snapshotId}\n`,
	)
}
