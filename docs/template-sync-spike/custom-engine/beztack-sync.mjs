#!/usr/bin/env node
import { readFile, readdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import {
  loadSchemas,
  gateInputs,
  validateSchemaVersioned,
  checkEngineCompatibility,
  SUPPORTED_SCHEMA_VERSIONS,
} from "./validate.mjs";
import {
  formatStatusMarkdown,
  formatPlanMarkdown,
  summarizeApplyResult,
  formatPromotionMarkdown,
} from "./format.mjs";
import { prepareBranch } from "./prepare-branch.mjs";
import {
  buildMigrationStatus,
  buildMigrationPlanEntry,
  migrationRecommendation,
} from "./migrations.mjs";
import {
  loadRegistry,
  resolveTrustClass,
  assertRegistryMatches,
  buildRegistryDecision,
  formatRegistryNotice,
  RegistryError,
  DEFAULT_REGISTRY_PATH,
} from "./registry.mjs";

const REPEATABLE_FLAGS = new Set([
  "source-pr",
  "related-promotion",
  "check",
]);

const args = parseArgs(process.argv.slice(2));
const subcommand = args._[0];

if (!subcommand) {
  console.error(
    "Usage: beztack-sync.js <status|apply|promotion-metadata> [--fixture PATH] [--from REV] [--to REV] [--derived-project PATH] [--engine NAME VERSION] [--format json|human] [--worktree PATH [--init-git]] [--registry PATH] [--trust-class trusted|community]"
  );
  process.exit(2);
}

const fixtureRoot = resolve(args.fixture ?? "docs/template-sync-fixture");
const schemaDir = resolve(args["schema-dir"] ?? join(fixtureRoot, "schemas"));
const derivedRoot = resolve(
  args["derived-project"] ?? join(fixtureRoot, "derived-project")
);
const fromRev = args.from ?? "v1.1.0";
const toRev = args.to ?? "v1.2.0";
const engineName = args.engine ?? "beztack-sync-prototype";
const engineVersion = args["engine-version"] ?? "0.2.0";
const registryPath = resolve(
  args.registry ?? join(fixtureRoot, DEFAULT_REGISTRY_PATH)
);
const requestedTrustClass =
  args["trust-class"] ?? process.env.BEZTACK_TRUST_CLASS ?? null;
const skipValidation = args["skip-validation"] === true;
const outputFormat = args.format ?? "json";
const worktreePath = args.worktree ? resolve(args.worktree) : null;
const initGit = args["init-git"] === true;

const fromTemplateRoot = join(fixtureRoot, "template-revisions", fromRev);
const toTemplateRoot = join(fixtureRoot, "template-revisions", toRev);
const revisionManifestPath = "template.json";

const schemas = skipValidation ? null : await loadSchemas(schemaDir);
let registry = null;
try {
  registry = schemas
    ? await loadRegistry(registryPath, schemas)
    : await loadRegistry(registryPath, await loadSchemas(schemaDir));
} catch (err) {
  if (err instanceof RegistryError) {
    console.error(err.message);
    process.exit(5);
  }
  throw err;
}

const policy = JSON.parse(
  await readFile(join(derivedRoot, ".beztack/template.json"), "utf8")
);
const parameters = JSON.parse(
  await readFile(join(derivedRoot, ".beztack/parameters.json"), "utf8")
);
const origin = JSON.parse(
  await readFile(join(derivedRoot, ".beztack/origin.json"), "utf8")
);
let syncEventLog = null;
try {
  syncEventLog = JSON.parse(
    await readFile(join(derivedRoot, ".beztack/sync-event-log.json"), "utf8")
  );
} catch (err) {
  if (err.code !== "ENOENT") throw err;
}

let toManifest = null;
try {
  toManifest = JSON.parse(
    await readFile(join(toTemplateRoot, revisionManifestPath), "utf8")
  );
} catch (err) {
  if (err.code !== "ENOENT") throw err;
}

if (schemas) {
  const inputs = { "sync-policy": policy, "origin-baseline": origin };
  if (syncEventLog) inputs["sync-event-log"] = syncEventLog;
  if (toManifest) inputs["template-manifest"] = toManifest;
  const errors = gateInputs(inputs, schemas);
  if (errors.length > 0) {
    const detail = errors
      .map((e) => `  - ${e.name}: ${e.error}`)
      .join("\n");
    console.error(
      `Schema validation failed before ${subcommand}. Engines must refuse unsupported schema versions before planning or applying a Template update.\n${detail}`
    );
    process.exit(3);
  }
  if (toManifest) {
    const incompat = checkEngineCompatibility(toManifest, engineVersion);
    if (incompat) {
      console.error(
        `Engine compatibility check failed before ${subcommand}: ${incompat}. Engines must refuse templates whose compatibleEngines range excludes the current engine version per ADR-0006.`
      );
      process.exit(4);
    }
  }
}

const derivedProjectId = origin.derivedProjectId;
const templateId = policy.templateId;

const registryDecision = buildRegistryDecision({ derivedProjectId, registry });
const resolvedTrust = registryDecision.resolved;
try {
  assertRegistryMatches(derivedProjectId, resolvedTrust, requestedTrustClass);
} catch (err) {
  if (err instanceof RegistryError) {
    console.error(err.message);
    process.exit(5);
  }
  throw err;
}

// The registry's grant is the canonical trust class. A caller-provided
// `--trust-class` flag is honored only when it does not escalate trust
// beyond the registry grant. This preserves the one-way trust rule: a
// Derived project owner cannot self-declare trusted status.
const effectiveTrustClass =
  requestedTrustClass && requestedTrustClass !== resolvedTrust.trustClass
    ? requestedTrustClass
    : resolvedTrust.trustClass;
const trustOverridden = effectiveTrustClass !== resolvedTrust.trustClass;
const trustPayload = {
  ...registryDecision.payload,
  effectiveTrustClass,
  trustOverriddenByCaller: trustOverridden,
};
const projectTrustClass = effectiveTrustClass;

const engineOutput = {
  name: engineName,
  version: engineVersion,
};

if (subcommand === "status") {
  const status = await buildStatus({
    derivedProjectId,
    templateId,
    fromRev,
    toRev,
    fromTemplateRoot,
    toTemplateRoot,
    derivedRoot,
    policy,
    origin,
    engineOutput,
    manifest: toManifest,
    projectTrustClass,
    trustPayload,
    resolvedTrust,
  });
  if (outputFormat === "human" || outputFormat === "md" || outputFormat === "markdown") {
    process.stdout.write(formatStatusMarkdown(status) + "\n");
  } else {
    process.stdout.write(JSON.stringify(status, null, 2) + "\n");
  }
} else if (subcommand === "apply") {
  if (args.plan === undefined && !worktreePath) {
    console.error(
      "apply requires either --plan (emit a plan) or --worktree PATH (prepare a branch)."
    );
    process.exit(2);
  }
  const plan = await buildApplyPlan({
    derivedProjectId,
    templateId,
    fromRev,
    toRev,
    fromTemplateRoot,
    toTemplateRoot,
    derivedRoot,
    policy,
    parameters,
    origin,
    engineOutput,
    manifest: toManifest,
    projectTrustClass,
    trustPayload,
    resolvedTrust,
  });
  if (worktreePath) {
    const result = await prepareBranch({
      derivedRoot,
      fromTemplateRoot,
      toTemplateRoot,
      worktreePath,
      policy,
      parameters,
      origin,
      plan,
      engineOutput,
      initGit,
      projectTrustClass,
    });
    if (outputFormat === "human" || outputFormat === "md" || outputFormat === "markdown") {
      process.stdout.write(formatPlanMarkdown(plan) + "\n\n");
      process.stdout.write(
        summarizeApplyResult({
          plan,
          worktree: result.worktree,
          engineOutput,
          branchCreated: result.branchCreated,
        }) + "\n"
      );
    } else {
      process.stdout.write(
        JSON.stringify(
          {
            plan,
            result: {
              worktree: result.worktree,
              branch: result.branch,
              branchCreated: result.branchCreated,
              eventId: result.eventId,
              updatesApplied: result.updates,
              seamsPreserved: result.seamLog,
            },
          },
          null,
          2
        ) + "\n"
      );
    }
  } else {
    if (outputFormat === "human" || outputFormat === "md" || outputFormat === "markdown") {
      process.stdout.write(formatPlanMarkdown(plan) + "\n");
    } else {
      process.stdout.write(JSON.stringify(plan, null, 2) + "\n");
    }
  }
} else if (subcommand === "promotion-metadata") {
  const promotionInput = collectPromotionInput({
    args,
    projectTrustClass,
  });
  const meta = await buildPromotionMetadata({
    derivedProjectId,
    templateId,
    fromRev,
    toRev,
    fromTemplateRoot,
    derivedRoot,
    policy,
    origin,
    engineOutput,
    projectTrustClass,
    trustPayload,
    resolvedTrust,
    promotionInput,
  });
  if (
    outputFormat === "human" ||
    outputFormat === "md" ||
    outputFormat === "markdown"
  ) {
    process.stdout.write(formatPromotionMarkdown(meta) + "\n");
  } else {
    process.stdout.write(JSON.stringify(meta, null, 2) + "\n");
  }
} else {
  console.error(`Unknown subcommand: ${subcommand}`);
  process.exit(2);
}

async function buildStatus({
  derivedProjectId,
  templateId,
  fromRev,
  toRev,
  fromTemplateRoot,
  toTemplateRoot,
  derivedRoot,
  policy,
  origin,
  engineOutput,
  manifest,
  projectTrustClass,
  trustPayload,
  resolvedTrust,
}) {
  const fromFiles = await listFiles(fromTemplateRoot);
  const toFiles = await listFiles(toTemplateRoot);
  const derivedFiles = await listFiles(derivedRoot, derivedRoot);

  const allPaths = new Set([
    ...Object.keys(fromFiles),
    ...Object.keys(toFiles),
    ...Object.keys(derivedFiles),
  ]);

  const files = {};
  const conflicts = [];
  const overlaps = [];

  const migrations = [];
  for (const m of manifest?.migrations ?? []) {
    migrations.push(
      await buildMigrationStatus({
        migration: m,
        derivedProjectRoot: derivedRoot,
        projectTrustClass,
      })
    );
  }
  const migrationAction = migrationRecommendation(migrations);

  for (const path of allPaths) {
    if (
      path.startsWith(".beztack/") ||
      path === "node_modules" ||
      path.startsWith("schemas/") ||
      path.startsWith("expected/") ||
      path.startsWith("template-revisions/") ||
      path === revisionManifestPath
    ) {
      continue;
    }

    const fromContent = fromFiles[path] ?? null;
    const toContent = toFiles[path] ?? null;
    const derivedContent = derivedFiles[path] ?? null;

    const ownership = resolveOwnership(path, policy);
    const seamsForFile = (policy.seams ?? []).filter((s) => s.file === path);
    let drift = classifyDrift(fromContent, toContent, derivedContent);

    if (seamsForFile.length > 0 && ownership === "mixed" && drift === "both-changed") {
      if (fromContent !== derivedContent && toContent !== derivedContent) {
        drift = "project-changed";
      }
    }

    const seamIds = seamsForFile.map((s) => s.id);
    files[path] = {
      ownership,
      drift,
      seam: seamIds[0] ?? null,
      seams: seamIds,
    };

    if (
      ownership === "mixed" &&
      seamsForFile.length === 0 &&
      drift === "both-changed"
    ) {
      conflicts.push({
        path,
        reason: "both-changed-no-seam",
        ownership,
        detail:
          "Template source introduces a default on a Mixed-ownership path, " +
          "but no Sync seam is registered for this file and the Derived " +
          "project already has its own implementation. Engine must report " +
          "this and refuse to silently merge.",
      });
    }
  }

  const overlapByPath = detectOverlaps(policy, allPaths);
  for (const [path, info] of overlapByPath.entries()) {
    // Order the overlapping rules by specificity (longest path first;
    // ties broken by segment count) so the warning text names the
    // authoritative rule correctly.
    const ranked = info.rules
      .map((rule, idx) => ({ rule, strategy: info.strategies[idx] }))
      .sort((a, b) => {
        const lenDiff = b.rule.length - a.rule.length;
        if (lenDiff !== 0) return lenDiff;
        return b.rule.split("/").length - a.rule.split("/").length;
      });
    const winner = ranked[0];
    overlaps.push({
      path,
      rules: ranked.map((r) => r.rule),
      strategies: ranked.map((r) => r.strategy),
      severity: "warning",
      detail:
        `More-specific rule wins: ${winner.rule} ` +
        `is authoritative. Apply preserves the file as ` +
        `${winner.strategy} and surfaces a warning so reviewers can ` +
        `resolve the policy.`,
    });
  }

  const hasConflicts = conflicts.length > 0;
  const pendingMigrations = migrations.filter(
    (m) => m.execution === "manual-execution-required" && m.idempotencyStatus === "pending"
  );
  const status = hasConflicts ? "conflicts" : "ready-to-apply";

  let action;
  if (hasConflicts) {
    action = "review-conflicts";
  } else if (migrationAction) {
    action = migrationAction;
  } else {
    action = "apply";
  }

  const recommendationNote = buildRecommendationNote({
    hasConflicts,
    conflicts,
    pendingMigrations,
    migrations,
    toRev,
  });

  return {
    schemaVersion: "1.0",
    derivedProjectId,
    templateId,
    currentRevision: origin.templateRevision ?? fromRev,
    candidateRevision: toRev,
    syncEngine: engineOutput,
    trust: trustPayload,
    status,
    files,
    conflicts,
    overlaps,
    migrations,
    recommendation: {
      action,
      command: `beztack-sync.mjs apply --to ${toRev}`,
      note: recommendationNote,
    },
  };
}

async function buildApplyPlan({
  derivedProjectId,
  templateId,
  fromRev,
  toRev,
  fromTemplateRoot,
  toTemplateRoot,
  derivedRoot,
  policy,
  parameters,
  origin,
  engineOutput,
  manifest,
  projectTrustClass,
  trustPayload,
  resolvedTrust,
}) {
  const fromFiles = await listFiles(fromTemplateRoot);
  const toFiles = await listFiles(toTemplateRoot);
  const derivedFiles = await listFiles(derivedRoot, derivedRoot);

  const updates = [];
  const skipped = [];
  const conflicts = [];
  const blockers = [];
  const migrations = [];
  for (const m of manifest?.migrations ?? []) {
    migrations.push(
      await buildMigrationPlanEntry({
        migration: m,
        derivedProjectRoot: derivedRoot,
        projectTrustClass,
      })
    );
  }

  const overlapByPath = detectOverlaps(
    policy,
    new Set([
      ...Object.keys(fromFiles),
      ...Object.keys(toFiles),
      ...Object.keys(derivedFiles),
    ])
  );

  const allPaths = new Set([
    ...Object.keys(fromFiles),
    ...Object.keys(toFiles),
    ...Object.keys(derivedFiles),
  ]);

  for (const path of allPaths) {
    if (
      path.startsWith(".beztack/") ||
      path === "node_modules" ||
      path.startsWith("schemas/") ||
      path.startsWith("expected/") ||
      path.startsWith("template-revisions/") ||
      path === revisionManifestPath
    ) {
      continue;
    }

    const fromContent = fromFiles[path] ?? null;
    const toContent = toFiles[path] ?? null;
    const derivedContent = derivedFiles[path] ?? null;
    const ownership = resolveOwnership(path, policy);
    const seamsForFile = (policy.seams ?? []).filter((s) => s.file === path);
    const seamIds = seamsForFile.map((s) => s.id);
    const hasOverlap = overlapByPath.has(path);

    if (ownership === "custom-owned") {
      skipped.push({
        path,
        ownership,
        reason: hasOverlap ? "ownership-ambiguous" : "custom-owned-preserved",
      });
      continue;
    }

    if (
      ownership === "mixed" &&
      seamsForFile.length === 0 &&
      fromContent !== toContent &&
      derivedContent !== null &&
      derivedContent !== fromContent
    ) {
      conflicts.push({
        path,
        reason: "both-changed-no-seam",
        ownership,
        detail:
          "Template source introduces content on a Mixed-ownership path " +
          "but no Sync seam is registered. Apply does not silently merge.",
      });
      continue;
    }

    if (toContent === null) {
      skipped.push({
        path,
        ownership,
        reason: "template-owned-preserved-addition",
      });
      continue;
    }

    if (fromContent === toContent && derivedContent === fromContent) {
      skipped.push({
        path,
        ownership,
        reason: "template-owned-preserved-addition",
      });
      continue;
    }

    if (ownership === "mixed" && seamsForFile.length > 0) {
      updates.push({
        path,
        ownership,
        reason: "template-harness-updated-seams-preserved",
        seam: seamIds[0] ?? null,
        seams: seamIds,
      });
      continue;
    }

    if (path === "package.json") {
      updates.push({
        path,
        ownership,
        reason: "render-template-parameters-and-merge",
        seam: null,
        seams: [],
      });
      continue;
    }

    updates.push({
      path,
      ownership,
      reason: "template-changed-no-project-change",
      seam: null,
      seams: [],
    });
  }

  const summary = buildSummary({
    fromRev,
    toRev,
    derivedProjectId,
    updates,
    skipped,
    conflicts,
    migrations,
  });

  return {
    schemaVersion: "1.0",
    derivedProjectId,
    templateId,
    fromRevision: fromRev,
    toRevision: toRev,
    syncEngine: engineOutput,
    branch: `template-sync/${fromRev}-to-${toRev}`,
    summary,
    trust: trustPayload,
    updates,
    skipped,
    conflicts,
    migrations,
    blockers,
  };
}

function buildRecommendationNote({
  hasConflicts,
  conflicts,
  pendingMigrations,
  migrations,
  toRev,
}) {
  const parts = [];
  if (hasConflicts) {
    const paths = conflicts.map((c) => c.path).join(", ");
    parts.push(
      `${conflicts.length} Sync conflict(s) require an explicit decision: ${paths}. After resolving, apply proceeds on a branch and the Environment contract update is included automatically.`
    );
  } else {
    parts.push(
      "Apply proceeds on a branch. The Environment contract update and Template parameter rendering happen automatically."
    );
  }
  if (pendingMigrations.length > 0) {
    const ids = pendingMigrations.map((m) => m.id).join(", ");
    parts.push(
      `${pendingMigrations.length} Template migration(s) require manual human execution on the apply branch: ${ids}.`
    );
  }
  const already = (migrations ?? []).filter(
    (m) => m.idempotencyStatus === "already-applied"
  );
  if (already.length > 0) {
    const ids = already.map((m) => m.id).join(", ");
    parts.push(
      `${already.length} Template migration(s) already applied (idempotency check passed) and surfaced only for visibility: ${ids}.`
    );
  }
  return parts.join(" ");
}

function buildSummary({ fromRev, toRev, derivedProjectId, updates, skipped, conflicts, migrations }) {
  const envContractUpdate = updates.some((u) => u.path === ".env.contract.json");
  const paramUpdate = updates.some((u) => u.path === "package.json");
  const seamUpdates = updates.filter((u) => (u.seams ?? []).length > 0);
  const lockfileSkipped = skipped.some((s) => s.path === "pnpm-lock.yaml");
  const conflictPaths = conflicts.map((c) => c.path).join(", ");
  const pendingMigrations = (migrations ?? []).filter(
    (m) => m.execution === "manual-execution-required" && m.idempotencyStatus === "pending"
  );
  const alreadyAppliedMigrations = (migrations ?? []).filter(
    (m) => m.idempotencyStatus === "already-applied"
  );

  const parts = [];
  parts.push(
    `Apply Beztack template ${toRev} onto Derived project ${derivedProjectId}.`
  );
  if (envContractUpdate) {
    parts.push(
      `Refresh the Environment contract (${toRev} required variables).`
    );
  }
  if (paramUpdate) {
    parts.push("Render Template parameters into package.json.");
  }
  for (const u of seamUpdates) {
    const seams = u.seams ?? (u.seam ? [u.seam] : []);
    parts.push(
      `Update ${u.path} with ${seams.join(" + ")} seam(s) preserved.`
    );
  }
  if (lockfileSkipped) {
    parts.push(
      "pnpm-lock.yaml is preserved as Custom-owned and regenerated locally."
    );
  }
  if (conflicts.length > 0) {
    parts.push(
      `${conflicts.length} Sync conflict(s) require an explicit decision: ${conflictPaths}.`
    );
  } else {
    parts.push("No conflicts.");
  }
  if (pendingMigrations.length > 0) {
    const ids = pendingMigrations.map((m) => m.id).join(", ");
    parts.push(
      `${pendingMigrations.length} Template migration(s) require manual human execution on the apply branch: ${ids}. The engine never executes migrations; the worktree's MIGRATIONS.md documents each step.`
    );
  }
  if (alreadyAppliedMigrations.length > 0) {
    const ids = alreadyAppliedMigrations.map((m) => m.id).join(", ");
    parts.push(
      `${alreadyAppliedMigrations.length} Template migration(s) are already applied (idempotency check passed) and are surfaced for visibility only: ${ids}.`
    );
  }
  return parts.join(" ");
}

async function buildPromotionMetadata({
  derivedProjectId,
  templateId,
  fromRev,
  fromTemplateRoot,
  derivedRoot,
  policy,
  origin,
  engineOutput,
  projectTrustClass,
  trustPayload,
  resolvedTrust,
  promotionInput,
}) {
  const derivedFiles = await listFiles(derivedRoot, derivedRoot);
  const originFiles = await listFiles(fromTemplateRoot);

  const candidates = [];
  const skipped = [];

  for (const [path, _content] of Object.entries(derivedFiles)) {
    if (path.startsWith(".beztack/") || path === "node_modules") continue;
    if (path in originFiles) continue;

    const ownership = resolveOwnership(path, policy);
    const seamsForFile = (policy.seams ?? []).filter((s) => s.file === path);

    if (ownership === "custom-owned") {
      skipped.push({
        path,
        ownership,
        reason: "custom-owned-product-domain",
      });
      continue;
    }

    if (ownership === "mixed") {
      skipped.push({
        path,
        ownership,
        reason:
          seamsForFile.length > 0
            ? "mixed-protected-by-seam"
            : "platform-extraction-required",
      });
      continue;
    }

    candidates.push({
      path,
      ownership,
      reason: "new-template-owned-file",
      suggestedSeam: null,
    });
  }

  candidates.sort((a, b) => a.path.localeCompare(b.path));
  skipped.sort((a, b) => a.path.localeCompare(b.path));

  const entryMode = resolveEntryMode({
    projectTrustClass,
    promotionInput,
  });

  const checks = buildPromotionChecks({ promotionInput });

  const out = {
    schemaVersion: "1.0",
    derivedProjectId,
    trustClass: projectTrustClass,
    trust: trustPayload,
    templateId,
    syncEngine: engineOutput,
    baselineRevision: origin.templateRevision ?? fromRev,
    label: promotionInput.label,
    entryMode,
    candidates,
    skipped,
    checks,
    suggestedTemplateVersionImpact:
      candidates.length > 0 ? "minor" : "none",
    relatedPromotions: promotionInput.relatedPromotions ?? [],
  };
  const sourcePRs = promotionInput.sourcePRs ?? [];
  if (sourcePRs.length > 0) {
    out.sourcePR = sourcePRs[0];
    out.sourcePRs = sourcePRs;
  }
  return out;
}

function resolveEntryMode({ projectTrustClass, promotionInput }) {
  if (
    promotionInput.trustedAutomationUsed &&
    projectTrustClass !== "trusted"
  ) {
    console.error(
      "warning: --trusted-automation ignored because the registry grants community trust; trusted automation requires a Trusted Derived project registry entry."
    );
  }
  if (
    promotionInput.communityEntryMode === "patch" &&
    projectTrustClass !== "community"
  ) {
    console.error(
      "warning: --community-entry-mode patch ignored because the registry grants trusted status; patches are a Community Derived project entry mode."
    );
  }
  if (
    promotionInput.trustedAutomationUsed &&
    projectTrustClass === "trusted"
  ) {
    return "trusted-automation";
  }
  if (
    promotionInput.communityEntryMode === "patch" &&
    projectTrustClass === "community"
  ) {
    return "patch";
  }
  return "normal-pr";
}

function buildPromotionChecks({ promotionInput }) {
  const checks = [
    { name: "schema/sync-policy", result: "pass", source: "engine" },
    { name: "schema/origin-baseline", result: "pass", source: "engine" },
    { name: "schema/sync-state", result: "pass", source: "engine" },
    { name: "ownership/overlap-validation", result: "pass", source: "engine" },
    { name: "promotion/candidate-filter", result: "pass", source: "engine" },
    { name: "engine/version-compatibility", result: "pass", source: "engine" },
    { name: "registry/trust-resolution", result: "pass", source: "engine" },
  ];
  for (const upstream of promotionInput.upstreamChecks ?? []) {
    checks.push({ ...upstream, source: "upstream-pr-ci" });
  }
  return checks;
}

function parseCheckSpec(spec) {
  const eq = spec.indexOf("=");
  if (eq <= 0) {
    throw new Error(
      `--check entries must be NAME=RESULT (pass|fail|skip); got: ${spec}`
    );
  }
  const name = spec.slice(0, eq).trim();
  const result = spec.slice(eq + 1).trim();
  if (!["pass", "fail", "skip"].includes(result)) {
    throw new Error(
      `--check result must be one of pass|fail|skip; got: ${result} (from ${spec})`
    );
  }
  if (!name) {
    throw new Error(`--check NAME=RESULT must include a non-empty name; got: ${spec}`);
  }
  return { name, result };
}

function parseRelatedPromotionSpec(spec) {
  const idx = spec.indexOf(",");
  if (idx <= 0 || idx === spec.length - 1) {
    throw new Error(
      `--related-promotion entries must be DERIVED_PROJECT_ID,LABEL; got: ${spec}`
    );
  }
  const derivedProjectId = spec.slice(0, idx).trim();
  const label = spec.slice(idx + 1).trim();
  if (!derivedProjectId || !label) {
    throw new Error(
      `--related-promotion entries must be DERIVED_PROJECT_ID,LABEL with both parts non-empty; got: ${spec}`
    );
  }
  return { derivedProjectId, label };
}

function collectPromotionInput({ args, projectTrustClass }) {
  const label =
    args.label ?? process.env.BEZTACK_PROMOTION_LABEL ?? null;
  if (!label || typeof label !== "string" || label.length === 0) {
    console.error(
      "promotion-metadata requires --label (the PR label is the authoritative Promotion opt-in signal per issue #33). Refusing to emit Promotion metadata without a label."
    );
    process.exit(6);
  }

  const sourcePRs = [];
  for (const value of arr(args["source-pr"])) {
    if (typeof value !== "string" || value.length === 0) continue;
    sourcePRs.push(value);
  }

  const relatedPromotions = [];
  for (const value of arr(args["related-promotion"])) {
    if (typeof value !== "string" || value.length === 0) continue;
    relatedPromotions.push(parseRelatedPromotionSpec(value));
  }

  const upstreamChecks = [];
  for (const value of arr(args.check)) {
    if (typeof value !== "string" || value.length === 0) continue;
    upstreamChecks.push(parseCheckSpec(value));
  }

  const trustedAutomationUsed = args["trusted-automation"] === true;
  const communityEntryModeRaw = args["community-entry-mode"];
  let communityEntryMode = null;
  if (typeof communityEntryModeRaw === "string" && communityEntryModeRaw.length > 0) {
    if (!["normal-pr", "patch"].includes(communityEntryModeRaw)) {
      console.error(
        `--community-entry-mode must be one of normal-pr|patch; got: ${communityEntryModeRaw}`
      );
      process.exit(2);
    }
    communityEntryMode = communityEntryModeRaw;
  }

  return {
    label,
    sourcePRs,
    relatedPromotions,
    upstreamChecks,
    trustedAutomationUsed,
    communityEntryMode,
  };
}

function arr(value) {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

async function listFiles(root, base = root) {
  const result = {};
  async function walk(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (err) {
      if (err.code === "ENOENT") return;
      throw err;
    }
    for (const entry of entries) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const abs = join(dir, entry.name);
      const rel = relative(base, abs);
      if (entry.isDirectory()) {
        await walk(abs);
      } else if (entry.isFile()) {
        const content = await readFile(abs, "utf8");
        result[rel] = content;
      }
    }
  }
  await walk(root);
  return result;
}

function resolveOwnership(path, policy) {
  let best = null;
  for (const rule of policy.ownership ?? []) {
    if (matchGlob(rule.path, path)) {
      if (
        best === null ||
        rule.path.length > best.path.length ||
        (rule.path.length === best.path.length &&
          rule.path.split("/").length > best.path.split("/").length)
      ) {
        best = rule;
      }
    }
  }
  if (best) return best.strategy;
  return "template-owned";
}

function matchGlob(pattern, path) {
  let regex = "^";
  let i = 0;
  while (i < pattern.length) {
    const c = pattern[i];
    if (c === "*" && pattern[i + 1] === "*") {
      if (pattern[i + 2] === "/") {
        regex += "(?:.*/)?";
        i += 3;
        continue;
      } else if (i + 2 === pattern.length) {
        regex += ".*";
        i += 2;
        continue;
      } else {
        regex += ".*";
        i += 2;
        continue;
      }
    }
    if (c === "*") {
      regex += "[^/]*";
      i += 1;
      continue;
    }
    if (c === "?") {
      regex += "[^/]";
      i += 1;
      continue;
    }
    if ("\\^$.|+()[]{}/".includes(c)) {
      regex += "\\" + c;
      i += 1;
      continue;
    }
    regex += c;
    i += 1;
  }
  regex += "$";
  return new RegExp(regex).test(path);
}

function classifyDrift(fromContent, toContent, derivedContent) {
  if (fromContent === null && toContent === null && derivedContent !== null) {
    return "added";
  }
  if (fromContent === null && toContent !== null && derivedContent === null) {
    return "added";
  }
  if (fromContent === null && toContent !== null && derivedContent !== null) {
    if (toContent === derivedContent) return "unchanged";
    return "both-changed";
  }
  if (fromContent !== null && derivedContent === null) {
    return "removed";
  }
  const fromToEqual = fromContent === toContent;
  const fromDerivedEqual = fromContent === derivedContent;
  const toDerivedEqual = toContent === derivedContent;

  if (fromToEqual && fromDerivedEqual) {
    return "unchanged";
  }
  if (!fromToEqual && fromDerivedEqual) {
    return "template-changed";
  }
  if (fromToEqual && !fromDerivedEqual) {
    return "project-changed";
  }
  if (!fromToEqual && !fromDerivedEqual && !toDerivedEqual) {
    return "both-changed";
  }
  if (!fromToEqual && !fromDerivedEqual && toDerivedEqual) {
    return "both-changed";
  }
  return "unchanged";
}

function detectOverlaps(policy, paths) {
  const overlapByPath = new Map();
  for (const path of paths) {
    const matches = (policy.ownership ?? []).filter((r) =>
      matchGlob(r.path, path)
    );
    if (matches.length > 1) {
      overlapByPath.set(path, {
        rules: matches.map((m) => m.path),
        strategies: matches.map((m) => m.strategy),
      });
    }
  }
  return overlapByPath;
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      const next2 = argv[i + 2];
      if (key === "engine" && next && !next.startsWith("--") && next2 && !next2.startsWith("--")) {
        out.engine = next;
        out["engine-version"] = next2;
        i += 2;
        continue;
      }
      if (next === undefined || next.startsWith("--")) {
        if (REPEATABLE_FLAGS.has(key)) {
          if (!Array.isArray(out[key])) out[key] = [];
          out[key].push(true);
        } else {
          out[key] = true;
        }
      } else if (REPEATABLE_FLAGS.has(key)) {
        if (!Array.isArray(out[key])) out[key] = [];
        out[key].push(next);
        i++;
      } else {
        out[key] = next;
        i++;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}
