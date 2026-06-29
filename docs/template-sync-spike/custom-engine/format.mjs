#!/usr/bin/env node
/**
 * Human-readable formatters for the Beztack Template Sync engine.
 *
 * Renders the same stable JSON contracts (sync-state, apply-plan) as
 * Markdown so humans can read the report, copy it into a PR description,
 * or paste it into chat. The JSON contract is the source of truth; this
 * module never produces new information, only a different view.
 */

import { basename } from "node:path";

function statusBadge(status) {
  switch (status) {
    case "ready-to-apply":
      return "READY TO APPLY";
    case "conflicts":
      return "CONFLICTS";
    case "policy-invalid":
      return "POLICY INVALID";
    case "engine-incompatible":
      return "ENGINE INCOMPATIBLE";
    case "in-sync":
      return "IN SYNC";
    default:
      return status.toUpperCase();
  }
}

function actionVerb(action) {
  switch (action) {
    case "apply":
      return "Apply the update";
    case "review-conflicts":
      return "Resolve conflicts, then apply";
    case "review-overlap":
      return "Review ownership overlap, then apply";
    case "review-environment":
      return "Review Environment contract, then apply";
    case "reset-engine":
      return "Reset the Sync engine version, then apply";
    case "no-action":
      return "No action required";
    default:
      return action;
  }
}

function formatStatusMarkdown(status) {
  const lines = [];
  lines.push(`# Sync status: ${statusBadge(status.status)}`);
  lines.push("");
  lines.push(
    `- **Derived project:** \`${status.derivedProjectId}\``
  );
  lines.push(`- **Template:** \`${status.templateId}\``);
  lines.push(`- **Current revision:** \`${status.currentRevision}\``);
  if (status.candidateRevision) {
    lines.push(`- **Target revision:** \`${status.candidateRevision}\``);
  }
  if (status.syncEngine) {
    lines.push(
      `- **Sync engine:** \`${status.syncEngine.name}@${status.syncEngine.version}\``
    );
  }
  lines.push("");

  if (status.recommendation) {
    lines.push("## Recommended next action");
    lines.push("");
    lines.push(`**${actionVerb(status.recommendation.action)}**`);
    if (status.recommendation.command) {
      lines.push("");
      lines.push("```bash");
      lines.push(status.recommendation.command);
      lines.push("```");
    }
    if (status.recommendation.note) {
      lines.push("");
      lines.push(status.recommendation.note);
    }
    lines.push("");
  }

  const fileEntries = Object.entries(status.files ?? {});
  if (fileEntries.length > 0) {
    lines.push("## Files");
    lines.push("");
    lines.push("| Path | Ownership | Drift | Seam |");
    lines.push("|------|-----------|-------|------|");
    for (const [path, entry] of fileEntries.sort(([a], [b]) =>
      a.localeCompare(b)
    )) {
      const seam = entry.seam ? `\`${entry.seam}\`` : "—";
      lines.push(
        `| \`${path}\` | ${entry.ownership} | ${entry.drift} | ${seam} |`
      );
    }
    lines.push("");
  }

  if (status.conflicts && status.conflicts.length > 0) {
    lines.push("## Sync conflicts");
    lines.push("");
    for (const c of status.conflicts) {
      lines.push(`- \`${c.path}\` — **${c.reason}** (${c.ownership})`);
      if (c.detail) lines.push(`  - ${c.detail}`);
    }
    lines.push("");
  } else {
    lines.push("## Sync conflicts");
    lines.push("");
    lines.push("None.");
    lines.push("");
  }

  if (status.overlaps && status.overlaps.length > 0) {
    lines.push("## Ownership overlaps (warnings)");
    lines.push("");
    for (const o of status.overlaps) {
      lines.push(
        `- \`${o.path}\` — severity \`${o.severity ?? "warning"}\`; rules \`${(o.rules ?? []).join(", ")}\`; strategies \`${(o.strategies ?? []).join(", ")}\``
      );
      if (o.detail) lines.push(`  - ${o.detail}`);
    }
    lines.push("");
  } else {
    lines.push("## Ownership overlaps");
    lines.push("");
    lines.push("None.");
    lines.push("");
  }

  return lines.join("\n");
}

function formatPlanMarkdown(plan) {
  const lines = [];
  lines.push(`# Apply plan: ${plan.fromRevision} → ${plan.toRevision}`);
  lines.push("");
  lines.push(
    `- **Derived project:** \`${plan.derivedProjectId}\``
  );
  lines.push(`- **Template:** \`${plan.templateId}\``);
  lines.push(`- **Branch:** \`${plan.branch}\``);
  if (plan.syncEngine) {
    lines.push(
      `- **Sync engine:** \`${plan.syncEngine.name}@${plan.syncEngine.version}\``
    );
  }
  lines.push("");
  if (plan.summary) {
    lines.push("## Summary");
    lines.push("");
    lines.push(plan.summary);
    lines.push("");
  }

  if (plan.conflicts && plan.conflicts.length > 0) {
    lines.push("## Sync conflicts");
    lines.push("");
    for (const c of plan.conflicts) {
      lines.push(`- \`${c.path}\` — **${c.reason}** (${c.ownership ?? "unknown"})`);
      if (c.detail) lines.push(`  - ${c.detail}`);
    }
    lines.push("");
  }

  if (plan.blockers && plan.blockers.length > 0) {
    lines.push("## Blockers");
    lines.push("");
    for (const b of plan.blockers) {
      lines.push(`- **${b.kind}** — ${b.detail}`);
    }
    lines.push("");
  } else {
    lines.push("## Blockers");
    lines.push("");
    lines.push("None. Apply may proceed on a branch.");
    lines.push("");
  }

  if (plan.updates && plan.updates.length > 0) {
    lines.push(`## Updates (${plan.updates.length})`);
    lines.push("");
    for (const u of plan.updates) {
      const seam = u.seam ? ` (seam \`${u.seam}\`)` : "";
      lines.push(`- \`${u.path}\` — ${u.ownership} — ${u.reason}${seam}`);
    }
    lines.push("");
  }

  if (plan.skipped && plan.skipped.length > 0) {
    lines.push(`## Skipped (${plan.skipped.length})`);
    lines.push("");
    for (const s of plan.skipped) {
      lines.push(`- \`${s.path}\` — ${s.ownership} — ${s.reason}`);
    }
    lines.push("");
  }

  lines.push("## Rollback");
  lines.push("");
  lines.push(
    "Rollback rides on the branch itself: close the PR or `git reset --hard` the branch tip. " +
      "Full-workspace snapshots are not part of the rollback model (ADR-0006)."
  );
  lines.push("");

  return lines.join("\n");
}

function formatBranchReadme({ plan, derivedProjectId, templateId, targetPath }) {
  const lines = [];
  lines.push(`# Template update branch ready for review`);
  lines.push("");
  lines.push(
    `This directory is the PR-ready state for applying Beztack template **${plan.toRevision}** ` +
      `onto Derived project \`${derivedProjectId}\` (template \`${templateId}\`).`
  );
  lines.push("");
  lines.push("It was prepared by the Beztack Sync engine on a dedicated branch " +
    `(\`${plan.branch}\`) — the original Derived project working tree is untouched.`);
  lines.push("");
  lines.push(`- **Worktree path:** \`${targetPath}\``);
  lines.push(`- **Branch name:** \`${plan.branch}\``);
  lines.push(`- **Sync engine:** \`${plan.syncEngine.name}@${plan.syncEngine.version}\``);
  lines.push("");

  if (plan.summary) {
    lines.push("## What this branch does");
    lines.push("");
    lines.push(plan.summary);
    lines.push("");
  }

  if (plan.updates && plan.updates.length > 0) {
    lines.push("## Files updated");
    lines.push("");
    for (const u of plan.updates) {
      const seam = u.seam ? ` (seam \`${u.seam}\`)` : "";
      lines.push(`- \`${u.path}\` — ${u.ownership} — ${u.reason}${seam}`);
    }
    lines.push("");
  }

  if (plan.skipped && plan.skipped.length > 0) {
    lines.push("## Files preserved (skipped on purpose)");
    lines.push("");
    for (const s of plan.skipped) {
      lines.push(`- \`${s.path}\` — ${s.ownership} — ${s.reason}`);
    }
    lines.push("");
  }

  if (plan.conflicts && plan.conflicts.length > 0) {
    lines.push("## Sync conflicts requiring a decision");
    lines.push("");
    lines.push(
      "These files were intentionally NOT modified on this branch. " +
        "Resolve them by registering a Sync seam, taking the Template version, " +
        "or skipping the update before opening the PR."
    );
    lines.push("");
    for (const c of plan.conflicts) {
      lines.push(`### \`${c.path}\``);
      lines.push("");
      lines.push(`- **Reason:** \`${c.reason}\``);
      if (c.ownership) lines.push(`- **Ownership:** \`${c.ownership}\``);
      if (c.detail) {
        lines.push("");
        lines.push(c.detail);
      }
      lines.push("");
    }
  }

  lines.push("## Derived artifacts (regenerate locally)");
  lines.push("");
  lines.push(
    "The Template source does not ship a lockfile. After this branch is checked out, " +
      "regenerate the lockfile with the Derived project's package manager before committing. " +
      "Do NOT copy a lockfile from the Template source."
  );
  lines.push("");
  lines.push("```bash");
  lines.push("pnpm install --lockfile-only   # or: npm install --package-lock-only, yarn install");
  lines.push("```");
  lines.push("");

  lines.push("## Next steps for the human reviewer");
  lines.push("");
  lines.push("1. Review the diff in this worktree against the Derived project's `main` branch.");
  lines.push("2. Resolve any conflicts listed above (or accept them as known limitations).");
  lines.push("3. Regenerate the lockfile as described.");
  lines.push("4. Commit the changes on this branch (the engine intentionally does not commit).");
  lines.push("5. Push and open a PR. Rollback is `git reset --hard` on the branch tip — no full-workspace snapshot was taken.");
  lines.push("");

  return lines.join("\n");
}

function summarizeApplyResult({ plan, worktree, engineOutput, branchCreated }) {
  const lines = [];
  lines.push(`PR-ready branch prepared.`);
  lines.push(`- Worktree: ${worktree}`);
  lines.push(`- Branch: ${plan.branch}${branchCreated ? " (git branch created)" : " (worktree-only; commit on review)"}`);
  lines.push(`- Sync engine: ${engineOutput.name}@${engineOutput.version}`);
  lines.push(`- Updates: ${plan.updates.length}`);
  lines.push(`- Skipped: ${plan.skipped.length}`);
  lines.push(`- Conflicts: ${plan.conflicts.length}`);
  lines.push(`- Blockers: ${plan.blockers.length}`);
  return lines.join("\n");
}

function shortName(path) {
  return basename(path);
}

export {
  formatStatusMarkdown,
  formatPlanMarkdown,
  formatBranchReadme,
  summarizeApplyResult,
};
