import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { UpdatePlan } from "./types.js";

export async function writePlanReport(
  workspaceRoot: string,
  plan: UpdatePlan,
): Promise<string> {
  const reportPath = join(workspaceRoot, "beztack-sync-report.md");
  const lines: string[] = [
    "# Beztack Template Sync Report",
    "",
    `- Total changes: ${plan.changes.length}`,
    `- Conflicts: ${plan.conflicts.length}`,
    `- Skipped unchanged template files: ${plan.skippedUnchangedTemplateFiles}`,
    "",
    "## Changes",
    "",
  ];

  if (plan.changes.length === 0) {
    lines.push("No changes detected.");
  } else {
    for (const change of plan.changes) {
      lines.push(
        `- [${change.type}] ${change.path} (${change.ownership})`,
      );
    }
  }

  lines.push("", "## Conflicts", "");

  if (plan.conflicts.length === 0) {
    lines.push("No conflicts detected.");
  } else {
    for (const conflict of plan.conflicts) {
      lines.push(
        `- ${conflict.path}: ${conflict.conflictReason || "unknown conflict"}`,
      );
    }
  }

  await writeFile(reportPath, `${lines.join("\n")}\n`, "utf-8");
  return reportPath;
}
