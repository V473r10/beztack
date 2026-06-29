#!/usr/bin/env node
/**
 * Template migration evaluation for the Beztack Sync engine.
 *
 * The engine NEVER executes migrations. It reads each migration declared by
 * the candidate Template manifest and:
 *   - evaluates the idempotency check against the current Derived project
 *     (without running any migration command);
 *   - surfaces the migration's mode, idempotency status, dry-run command,
 *     and apply command in status / apply output so a human reviewer can
 *     decide what to run.
 *
 * This module is the part of issue #34. It is intentionally minimal: it
 * implements the idempotency check evaluation the schemas document and
 * leaves the migration runner (the human + their CI) outside the engine.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * Decide how a migration must be executed for a given Derived project trust
 * class. Manual / interactive / destructive migrations always require manual
 * execution. Community projects never run any migration automatically.
 *
 * Returns one of "engine-surfaces-only" | "manual-execution-required".
 */
export function evaluateExecution(migration, trustClass) {
  if (migration.interactive || migration.destructive) return "manual-execution-required";
  if (migration.mode === "manual") return "manual-execution-required";
  if (trustClass === "community") return "manual-execution-required";
  return "engine-surfaces-only";
}

/**
 * Choose a stable action string for a migration in status output. Stable
 * strings so CI / agents can match on them without parsing prose.
 */
export function evaluateAction({ execution, idempotencyStatus, mode, trustClass, projectTrustClass }) {
  if (idempotencyStatus === "already-applied") return "no-human-action-required";
  if (mode === "manual" || execution === "manual-execution-required") return "human-runs-apply-command";
  if (projectTrustClass === "community" && trustClass === "trusted") return "human-runs-apply-command-trust-class-mismatch";
  return "human-runs-apply-command";
}

/**
 * Evaluate a single migration's idempotency check against the Derived
 * project. The engine never executes migration commands; for
 * command-succeeds checks it returns "pending" unconditionally and the
 * human runs the command.
 */
export async function evaluateIdempotency(migration, derivedProjectRoot) {
  const check = migration.idempotency ?? {};
  if (check.type === "file-exists") {
    if (typeof check.path !== "string" || check.path.length === 0) {
      return { status: "pending", detail: "missing idempotency.path for file-exists check" };
    }
    try {
      await readFile(resolve(derivedProjectRoot, check.path), "utf8");
      return { status: "already-applied", detail: `file-exists ${check.path}` };
    } catch (err) {
      if (err.code === "ENOENT") {
        return { status: "pending", detail: `file-exists ${check.path} (not present)` };
      }
      throw err;
    }
  }
  if (check.type === "marker-present") {
    if (typeof check.path !== "string" || check.path.length === 0) {
      return { status: "pending", detail: "missing idempotency.path for marker-present check" };
    }
    if (typeof check.marker !== "string" || check.marker.length === 0) {
      return { status: "pending", detail: "missing idempotency.marker for marker-present check" };
    }
    try {
      const text = await readFile(resolve(derivedProjectRoot, check.path), "utf8");
      if (text.includes(check.marker)) {
        return { status: "already-applied", detail: `marker-present ${check.path} (contains '${check.marker}')` };
      }
      return { status: "pending", detail: `marker-present ${check.path} (does not contain '${check.marker}')` };
    } catch (err) {
      if (err.code === "ENOENT") {
        return { status: "pending", detail: `marker-present ${check.path} (file not present)` };
      }
      throw err;
    }
  }
  if (check.type === "command-succeeds") {
    return { status: "pending", detail: `command-succeeds '${check.command}' (engine does not run it)` };
  }
  return { status: "pending", detail: `unknown idempotency type ${check.type}` };
}

/**
 * Build the human-readable description of the idempotency check, used in
 * status / apply output as `idempotencyCheck`.
 */
export function describeIdempotencyCheck(migration) {
  const check = migration.idempotency ?? {};
  if (check.type === "file-exists") return `file-exists ${check.path ?? ""}`.trim();
  if (check.type === "marker-present") {
    return `marker-present ${check.path ?? ""} (looking for '${check.marker ?? ""}')`;
  }
  if (check.type === "command-succeeds") {
    return `command-succeeds '${check.command ?? ""}' (engine does not run; treated as pending)`;
  }
  return `unknown idempotency type ${check.type ?? "undefined"}`;
}

/**
 * Build the status-shape migration entry for one migration declared in the
 * candidate Template manifest.
 */
export async function buildMigrationStatus({ migration, derivedProjectRoot, projectTrustClass }) {
  const execution = evaluateExecution(migration, projectTrustClass);
  const idempotency = await evaluateIdempotency(migration, derivedProjectRoot);
  const idempotencyCheck = describeIdempotencyCheck(migration);
  const action = evaluateAction({
    execution,
    idempotencyStatus: idempotency.status,
    mode: migration.mode,
    trustClass: migration.trustClass ?? "any",
    projectTrustClass,
  });
  return {
    id: migration.id,
    mode: migration.mode,
    description: migration.description ?? "",
    idempotencyCheck,
    idempotencyStatus: idempotency.status,
    interactive: Boolean(migration.interactive),
    destructive: Boolean(migration.destructive),
    trustClass: migration.trustClass ?? "any",
    execution,
    dryRunCommand: migration.dryRun?.command ?? null,
    applyCommand: migration.applyCommand ?? null,
    action,
    note: migration.note ?? "",
  };
}

/**
 * Build the apply-plan-shape migration entry for one migration. Mirrors
 * buildMigrationStatus but uses the apply-plan schema fields.
 */
export async function buildMigrationPlanEntry({ migration, derivedProjectRoot, projectTrustClass }) {
  const execution = evaluateExecution(migration, projectTrustClass);
  const idempotency = await evaluateIdempotency(migration, derivedProjectRoot);
  const isPending = idempotency.status === "pending";
  const isCommunity = projectTrustClass === "community";
  const isTrustedOnly = (migration.trustClass ?? "any") === "trusted";

  let branchAction;
  if (!isPending) {
    branchAction = "no-action-required";
  } else if (isCommunity) {
    branchAction = "reviewer-runs-apply-command-locally-community-must-execute-manually";
  } else if (isTrustedOnly) {
    branchAction = "reviewer-runs-apply-command-trusted-automation-allowed";
  } else {
    branchAction = "reviewer-runs-apply-command-before-or-after-merge";
  }

  const idempotencyPayload = { type: migration.idempotency?.type ?? "command-succeeds" };
  if (typeof migration.idempotency?.path === "string") idempotencyPayload.path = migration.idempotency.path;
  if (typeof migration.idempotency?.marker === "string") idempotencyPayload.marker = migration.idempotency.marker;
  if (typeof migration.idempotency?.command === "string") idempotencyPayload.command = migration.idempotency.command;

  return {
    id: migration.id,
    mode: migration.mode,
    description: migration.description ?? "",
    idempotency: idempotencyPayload,
    idempotencyStatus: idempotency.status,
    interactive: Boolean(migration.interactive),
    destructive: Boolean(migration.destructive),
    trustClass: migration.trustClass ?? "any",
    execution,
    applyOnBranch: true,
    dryRunCommand: migration.dryRun?.command ?? null,
    applyCommand: migration.applyCommand ?? null,
    branchAction,
    note: migration.note ?? "",
  };
}

/**
 * Decide whether the recommendation action should mention migrations.
 * Returns "review-migrations" when at least one migration is pending AND
 * would need human attention (i.e. execution is manual-execution-required).
 */
export function migrationRecommendation(migrations) {
  const hasPendingManual = migrations.some(
    (m) => m.execution === "manual-execution-required" && m.idempotencyStatus === "pending"
  );
  return hasPendingManual ? "review-migrations" : null;
}

/**
 * Build the MIGRATIONS.md body for the apply branch's worktree. The body
 * documents each migration step, its idempotency status, and what the
 * reviewer must do. Engine never executes migrations; this file is the
 * reviewer's checklist.
 */
export function formatMigrationReadme({
  migrations,
  planBranch,
  fromRevision,
  toRevision,
  derivedProjectId,
  projectTrustClass,
}) {
  const lines = [];
  lines.push(`# Template migrations: ${fromRevision} → ${toRevision}`);
  lines.push("");
  lines.push(
    `The Beztack Sync engine surfaces these Template migration steps for Derived project ` +
      `\`${derivedProjectId}\` on branch \`${planBranch}\`. **The engine does not execute any migration.** ` +
      `Reviewers must run each \`manual-execution-required\` step explicitly per the instructions below.`
  );
  lines.push("");
  lines.push(`- **Derived project trust class:** \`${projectTrustClass}\``);
  if (projectTrustClass === "community") {
    lines.push("");
    lines.push(
      "> Community Derived projects must run every migration step locally and explicitly. " +
        "The Beztack Sync engine never executes migrations on Community projects, regardless of " +
        "the migration's declared `mode` or `trustClass`."
    );
  }
  lines.push("");

  if (!migrations || migrations.length === 0) {
    lines.push("No Template migrations are declared at this Template version.");
    lines.push("");
    return lines.join("\n");
  }

  for (const m of migrations) {
    lines.push(`## \`${m.id}\``);
    lines.push("");
    lines.push(`- **Mode:** \`${m.mode}\``);
    lines.push(`- **Execution:** \`${m.execution}\``);
    lines.push(`- **Idempotency check:** \`${m.idempotencyCheck ?? "n/a"}\``);
    lines.push(`- **Idempotency status:** \`${m.idempotencyStatus}\``);
    lines.push(`- **Interactive:** \`${m.interactive}\``);
    lines.push(`- **Destructive:** \`${m.destructive}\``);
    lines.push(`- **Trust class:** \`${m.trustClass}\``);
    if (m.dryRunCommand) {
      lines.push("- **Dry run:**");
      lines.push("");
      lines.push("  ```bash");
      lines.push(`  ${m.dryRunCommand}`);
      lines.push("  ```");
    }
    if (m.applyCommand) {
      lines.push("- **Apply command (engine never runs it):**");
      lines.push("");
      lines.push("  ```bash");
      lines.push(`  ${m.applyCommand}`);
      lines.push("  ```");
    }
    lines.push("");
    if (m.idempotencyStatus === "already-applied") {
      lines.push("**Action:** No action required. The idempotency check passed; this migration has already been applied to this Derived project.");
    } else if (m.execution === "manual-execution-required") {
      lines.push("**Action:** Manual execution required. A human must run the apply command (and optionally the dry-run command) locally on the apply branch.");
    } else {
      lines.push("**Action:** Surface only. The engine reports this migration; no manual execution is required.");
    }
    if (m.note) {
      lines.push("");
      lines.push(m.note);
    }
    lines.push("");
  }

  lines.push("## Rollback");
  lines.push("");
  lines.push(
    "Migrations are recorded on this branch only as documentation. Rolling back the branch with `git reset --hard` " +
      "removes the migration documentation; it does not undo any migration the human has already executed locally. " +
      "To undo an executed migration, follow the migration's own rollback procedure (none is provided by the engine)."
  );
  lines.push("");

  return lines.join("\n");
}