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
    case "review-migrations":
      return "Review Template migrations, then apply";
    case "reset-engine":
      return "Reset the Sync engine version, then apply";
    case "no-action":
      return "No action required";
    default:
      return action;
  }
}

function migrationStatusLabel(status) {
  if (status === "already-applied") return "ALREADY APPLIED";
  if (status === "pending") return "PENDING";
  return status.toUpperCase();
}

function executionLabel(execution) {
  if (execution === "manual-execution-required") return "MANUAL EXECUTION REQUIRED";
  if (execution === "engine-surfaces-only") return "ENGINE SURFACES ONLY";
  return execution.toUpperCase();
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

  if (status.trust) {
    lines.push("## Beztack registry (trust source)");
    lines.push("");
    lines.push(formatTrustBlock(status.trust));
    lines.push("");
  }

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

  const migrations = status.migrations ?? [];
  if (migrations.length > 0) {
    lines.push("## Template migrations");
    lines.push("");
    lines.push(
      "Template migrations are declared separately from Template-owned file content per PRD-27 stories 37-39. " +
        "The Beztack Sync engine never executes migrations; it evaluates each migration's idempotency check " +
        "and surfaces the manual steps a human must run."
    );
    lines.push("");
    lines.push("| Id | Mode | Idempotency status | Execution | Trust class | Action |");
    lines.push("|----|------|--------------------|-----------|-------------|--------|");
    for (const m of migrations) {
      lines.push(
        `| \`${m.id}\` | ${m.mode} | ${migrationStatusLabel(m.idempotencyStatus)} (${m.idempotencyCheck}) | ${executionLabel(m.execution)} | ${m.trustClass} | ${m.action} |`
      );
    }
    lines.push("");
    const pendingManual = migrations.filter(
      (m) => m.execution === "manual-execution-required" && m.idempotencyStatus === "pending"
    );
    if (pendingManual.length > 0) {
      lines.push("**Pending manual migrations:**");
      lines.push("");
      for (const m of pendingManual) {
        if (m.dryRunCommand) {
          lines.push("- Dry run:");
          lines.push("");
          lines.push("  ```bash");
          lines.push(`  ${m.dryRunCommand}`);
          lines.push("  ```");
        }
        if (m.applyCommand) {
          lines.push("- Apply (engine never runs this):");
          lines.push("");
          lines.push("  ```bash");
          lines.push(`  ${m.applyCommand}`);
          lines.push("  ```");
        }
      }
      lines.push("");
    }
  } else {
    lines.push("## Template migrations");
    lines.push("");
    lines.push("None declared at this Template version.");
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
  if (plan.trust) {
    lines.push("## Beztack registry (trust source)");
    lines.push("");
    lines.push(formatTrustBlock(plan.trust));
    lines.push("");
  }
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

  const migrations = plan.migrations ?? [];
  if (migrations.length > 0) {
    lines.push(`## Template migrations (${migrations.length})`);
    lines.push("");
    lines.push(
      "Template migrations are declared separately from Template-owned file content per PRD-27 stories 37-39. " +
        "The engine never executes migrations; the apply branch's `MIGRATIONS.md` documents each step for the reviewer."
    );
    lines.push("");
    lines.push("| Id | Mode | Idempotency | Execution | Trust class | Branch action |");
    lines.push("|----|------|-------------|-----------|-------------|---------------|");
    for (const m of migrations) {
      lines.push(
        `| \`${m.id}\` | ${m.mode} | ${migrationStatusLabel(m.idempotencyStatus)} | ${executionLabel(m.execution)} | ${m.trustClass} | ${m.branchAction ?? "—"} |`
      );
    }
    lines.push("");
    const pendingManual = migrations.filter(
      (m) => m.execution === "manual-execution-required" && m.idempotencyStatus === "pending"
    );
    if (pendingManual.length > 0) {
      lines.push("**Pending manual migrations (engine never runs these):**");
      lines.push("");
      for (const m of pendingManual) {
        lines.push(`### \`${m.id}\``);
        lines.push("");
        if (m.dryRunCommand) {
          lines.push("- Dry run:");
          lines.push("");
          lines.push("  ```bash");
          lines.push(`  ${m.dryRunCommand}`);
          lines.push("  ```");
        }
        if (m.applyCommand) {
          lines.push("- Apply command (engine never runs this):");
          lines.push("");
          lines.push("  ```bash");
          lines.push(`  ${m.applyCommand}`);
          lines.push("  ```");
        }
        if (m.note) {
          lines.push("");
          lines.push(m.note);
        }
        lines.push("");
      }
    }
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
  if (plan.trust) {
    lines.push(`- **Trust class:** \`${plan.trust.trustClass}\` (registry source: \`${plan.trust.source}\`)`);
    if (plan.trust.repository?.canonicalUrl) {
      lines.push(`- **Repository:** \`${plan.trust.repository.canonicalUrl}\``);
    }
  }
  lines.push("");
  lines.push(
    "The Derived project ID is the **opaque stable identifier** generated at scaffolding. " +
      "Renaming the GitHub repository or moving the remote URL does NOT change the ID; " +
      "traceability rides on the ID, not on the URL. The Beztack-owned registry records " +
      "the canonical URL plus a rename history (`knownUrls`) so renames are auditable."
  );
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

  const migrations = plan.migrations ?? [];
  if (migrations.length > 0) {
    const pendingManual = migrations.filter(
      (m) => m.execution === "manual-execution-required" && m.idempotencyStatus === "pending"
    );
    lines.push("## Template migrations");
    lines.push("");
    lines.push(
      "The Beztack Sync engine never executes Template migrations. " +
        "See `MIGRATIONS.md` for the full per-step checklist (idempotency checks, dry-run commands, " +
        "apply commands, and reviewer actions)."
    );
    lines.push("");
    if (pendingManual.length > 0) {
      lines.push(
        `**${pendingManual.length} migration(s) require manual human execution before or after merging this branch:**`
      );
      lines.push("");
      for (const m of pendingManual) {
        lines.push(`- \`${m.id}\` — ${m.execution} — trust class \`${m.trustClass}\` — ${m.branchAction ?? ""}`);
        if (m.applyCommand) {
          lines.push(`  - apply: \`${m.applyCommand}\``);
        }
        if (m.dryRunCommand) {
          lines.push(`  - dry run: \`${m.dryRunCommand}\``);
        }
      }
      lines.push("");
    } else {
      lines.push(
        "All declared migrations are either already-applied (idempotency check passed) or surface-only."
      );
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
  const migrations = plan.migrations ?? [];
  const pendingManual = migrations.filter(
    (m) => m.execution === "manual-execution-required" && m.idempotencyStatus === "pending"
  );
  lines.push(`PR-ready branch prepared.`);
  lines.push(`- Worktree: ${worktree}`);
  lines.push(`- Branch: ${plan.branch}${branchCreated ? " (git branch created)" : " (worktree-only; commit on review)"}`);
  lines.push(`- Sync engine: ${engineOutput.name}@${engineOutput.version}`);
  lines.push(`- Updates: ${plan.updates.length}`);
  lines.push(`- Skipped: ${plan.skipped.length}`);
  lines.push(`- Conflicts: ${plan.conflicts.length}`);
  lines.push(`- Migrations: ${migrations.length} declared (${pendingManual.length} require manual execution)`);
  lines.push(`- Blockers: ${plan.blockers.length}`);
  return lines.join("\n");
}

function shortName(path) {
  return basename(path);
}

function formatTrustBlock(trust) {
  const lines = [];
  lines.push(`- **Trust class (registry grant):** \`${trust.trustClass}\``);
  lines.push(`- **Trust class (effective for this run):** \`${trust.effectiveTrustClass}\``);
  if (trust.trustOverriddenByCaller) {
    lines.push("- **Caller overrode trust class for this run** (registry permit only; cannot escalate beyond the registry grant).");
  }
  lines.push(`- **Source:** \`${trust.source}\``);
  lines.push(`- **Registry:** \`${trust.registryId}\` (version \`${trust.registryVersion}\`)`);
  if (trust.repository) {
    lines.push(`- **Repository:** \`${trust.repository.canonicalUrl}\``);
    if (trust.repository.displayName) {
      lines.push(`- **Display name:** \`${trust.repository.displayName}\``);
    }
    if (Array.isArray(trust.repository.knownUrls) && trust.repository.knownUrls.length > 1) {
      lines.push(
        `- **Known remote URLs (rename history):** ${trust.repository.knownUrls.map((u) => `\`${u}\``).join(", ")}`
      );
    }
  }
  if (trust.note) {
    lines.push("");
    lines.push(trust.note);
  }
  if (trust.source !== "registry-listed") {
    lines.push("");
    lines.push(
      "> **Community fallback:** because the registry does not list this Derived project ID (or the entry was revoked), the engine treats it as a Community Derived project. Trust is one-way: a Derived project cannot self-declare trusted status. The maintainer consumes releases via local tooling without Beztack-held permissions."
    );
  } else if (trust.repository?.canonicalUrl) {
    lines.push("");
    lines.push(
      `> **Trusted dispatch:** because the registry lists \`${trust.repository.canonicalUrl}\` as a Trusted Derived project, Beztack-owned tooling may dispatch automated update notifications to this canonical URL. The maintainer retains the option to opt out per run via \`--trust-class community\`.`
    );
  }
  return lines.join("\n");
}

function entryModeLabel(mode) {
  if (mode === "trusted-automation") return "TRUSTED AUTOMATION";
  if (mode === "patch") return "PATCH (COMMUNITY)";
  if (mode === "normal-pr") return "NORMAL PR";
  return mode.toUpperCase();
}

function formatPromotionMarkdown(meta) {
  const lines = [];
  lines.push("# Promotion metadata");
  lines.push("");
  lines.push(`- **Derived project:** \`${meta.derivedProjectId}\``);
  lines.push(`- **Template:** \`${meta.templateId}\``);
  lines.push(`- **Baseline revision:** \`${meta.baselineRevision}\``);
  lines.push(`- **Promotion label:** \`${meta.label}\``);
  lines.push(`- **Entry mode:** ${entryModeLabel(meta.entryMode)} (\`${meta.entryMode}\`)`);
  if (meta.entryMode === "trusted-automation") {
    lines.push("");
    lines.push(
      "> **Trusted automation:** the source PR was opened by Beztack-owned automation because the registry lists this Derived project ID as trusted. Beztack review is still required before any change enters the Template source (ADR-0006)."
    );
  } else if (meta.entryMode === "patch") {
    lines.push("");
    lines.push(
      "> **Community patch entry:** the source PR was submitted as a patch from a Community Derived project. Beztack CI must validate the patch before review (ADR-0006)."
    );
  } else {
    lines.push("");
    lines.push(
      "> **Normal PR:** the source PR was opened by the Derived project maintainer. Beztack review is required before any change enters the Template source (ADR-0006)."
    );
  }
  if (meta.syncEngine) {
    lines.push(`- **Sync engine:** \`${meta.syncEngine.name}@${meta.syncEngine.version}\``);
  }
  lines.push("");

  if (meta.sourcePRs && meta.sourcePRs.length > 0) {
    lines.push("## Source PR / issue links");
    lines.push("");
    for (const ref of meta.sourcePRs) {
      lines.push(`- \`${ref}\``);
    }
    lines.push("");
  }

  if (meta.trust) {
    lines.push("## Beztack registry (trust source)");
    lines.push("");
    lines.push(formatTrustBlock(meta.trust));
    lines.push("");
  }

  if (meta.candidates && meta.candidates.length > 0) {
    lines.push(`## Promotion candidates (${meta.candidates.length})`);
    lines.push("");
    lines.push(
      "Files eligible for direct Promotion. Ownership is Template-owned per the Beztack-owned Sync policy."
    );
    lines.push("");
    lines.push("| Path | Ownership | Reason | Suggested seam |");
    lines.push("|------|-----------|--------|----------------|");
    for (const c of meta.candidates) {
      const seam = c.suggestedSeam ? `\`${c.suggestedSeam}\`` : "—";
      lines.push(`| \`${c.path}\` | ${c.ownership} | ${c.reason} | ${seam} |`);
    }
    lines.push("");
  } else {
    lines.push("## Promotion candidates");
    lines.push("");
    lines.push("None. The source PR did not touch any Template-owned path.");
    lines.push("");
  }

  if (meta.skipped && meta.skipped.length > 0) {
    lines.push(`## Skipped files (${meta.skipped.length})`);
    lines.push("");
    lines.push(
      "Files excluded from Promotion by ownership. Custom-owned Product-domain files are excluded by default (issue #33). Mixed-without-seam files are surfaced for Platform extraction rather than direct Promotion."
    );
    lines.push("");
    lines.push("| Path | Ownership | Reason |");
    lines.push("|------|-----------|--------|");
    for (const s of meta.skipped) {
      lines.push(`| \`${s.path}\` | ${s.ownership} | \`${s.reason}\` |`);
    }
    lines.push("");
    const platformExtractions = meta.skipped.filter(
      (s) => s.reason === "platform-extraction-required"
    );
    if (platformExtractions.length > 0) {
      lines.push(
        `> **Platform extraction guidance:** ${platformExtractions.length} file(s) require Platform extraction rather than direct Promotion (see CONTEXT.md). Do not copy Custom-owned Product domain code into Beztack; design a reusable Template-source abstraction intentionally.`
      );
      lines.push("");
    }
  } else {
    lines.push("## Skipped files");
    lines.push("");
    lines.push("None.");
    lines.push("");
  }

  if (meta.checks && meta.checks.length > 0) {
    lines.push(`## Checks (${meta.checks.length})`);
    lines.push("");
    lines.push("| Name | Result | Source |");
    lines.push("|------|--------|--------|");
    for (const c of meta.checks) {
      lines.push(`| \`${c.name}\` | ${c.result} | \`${c.source ?? "engine"}\` |`);
    }
    lines.push("");
  }

  if (meta.relatedPromotions && meta.relatedPromotions.length > 0) {
    lines.push(`## Related overlapping Promotions (${meta.relatedPromotions.length})`);
    lines.push("");
    lines.push(
      "Overlapping Promotions are linked for reviewer awareness rather than auto-deduplicated. Reviewers must reconcile conflicting ideas in PR review."
    );
    lines.push("");
    for (const r of meta.relatedPromotions) {
      lines.push(`- \`${r.derivedProjectId}\` — label \`${r.label}\``);
    }
    lines.push("");
  }

  lines.push("## Suggested Template version impact");
  lines.push("");
  lines.push(`- **Suggested impact:** \`${meta.suggestedTemplateVersionImpact}\``);
  lines.push(
    "- **Publish policy:** engines do not auto-publish Template versions on Promotion merge. The new Template version is tagged explicitly by Beztack maintainers (PRD-27 out-of-scope item)."
  );
  lines.push("");

  lines.push("## Distinction from Platform extraction");
  lines.push("");
  lines.push(
    "Promotion copies Template-owned content from a Derived project PR back into the Template source. " +
      "Platform extraction redesigns a Product-domain idea into a reusable Template-source abstraction intentionally. " +
      "Engines must never copy Custom-owned Product-domain code into Beztack; use Platform extraction instead (issue #33, PRD-27 out-of-scope item)."
  );
  lines.push("");

  return lines.join("\n");
}

export {
  formatStatusMarkdown,
  formatPlanMarkdown,
  formatBranchReadme,
  summarizeApplyResult,
  formatTrustBlock,
  formatPromotionMarkdown,
};
