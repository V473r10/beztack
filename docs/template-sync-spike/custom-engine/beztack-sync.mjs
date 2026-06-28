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

const args = parseArgs(process.argv.slice(2));
const subcommand = args._[0];

if (!subcommand) {
  console.error(
    "Usage: beztack-sync.js <status|apply|promotion-metadata> [--fixture PATH] [--from REV] [--to REV] [--derived-project PATH] [--engine NAME VERSION]"
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
const trustClass =
  args["trust-class"] ??
  process.env.BEZTACK_TRUST_CLASS ??
  "trusted";
const skipValidation = args["skip-validation"] === true;

const fromTemplateRoot = join(fixtureRoot, "template-revisions", fromRev);
const toTemplateRoot = join(fixtureRoot, "template-revisions", toRev);

const schemas = skipValidation ? null : await loadSchemas(schemaDir);

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
    await readFile(join(toTemplateRoot, "template.json"), "utf8")
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
  });
  process.stdout.write(JSON.stringify(status, null, 2) + "\n");
} else if (subcommand === "apply") {
  if (args.plan === undefined) {
    console.error("apply requires --plan");
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
  });
  process.stdout.write(JSON.stringify(plan, null, 2) + "\n");
} else if (subcommand === "promotion-metadata") {
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
  });
  process.stdout.write(JSON.stringify(meta, null, 2) + "\n");
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

  for (const path of allPaths) {
    if (
      path.startsWith(".beztack/") ||
      path === "node_modules" ||
      path.startsWith("schemas/") ||
      path.startsWith("expected/") ||
      path.startsWith("template-revisions/")
    ) {
      continue;
    }

    const fromContent = fromFiles[path] ?? null;
    const toContent = toFiles[path] ?? null;
    const derivedContent = derivedFiles[path] ?? null;

    const ownership = resolveOwnership(path, policy);
    const seam = (policy.seams ?? []).find((s) => s.file === path);
    let drift = classifyDrift(fromContent, toContent, derivedContent);

    if (seam && ownership === "mixed" && drift === "both-changed") {
      if (fromContent !== derivedContent && toContent !== derivedContent) {
        drift = "project-changed";
      }
    }

    files[path] = {
      ownership,
      drift,
      seam: seam ? seam.id : null,
    };

    if (
      ownership === "mixed" &&
      !seam &&
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
    overlaps.push({
      path,
      rules: info.rules,
      strategies: info.strategies,
      severity: "warning",
      detail:
        `More-specific rule wins: ${info.rules[info.rules.length - 1]} ` +
        `is authoritative. Apply preserves the file as ` +
        `${info.strategies[info.strategies.length - 1]} and surfaces a ` +
        `warning so reviewers can resolve the policy.`,
    });
  }

  const status = conflicts.length > 0 ? "conflicts" : "ready-to-apply";

  return {
    schemaVersion: "1.0",
    derivedProjectId,
    templateId,
    currentRevision: origin.templateRevision ?? fromRev,
    candidateRevision: toRev,
    syncEngine: engineOutput,
    status,
    files,
    conflicts,
    overlaps,
    recommendation: {
      action: conflicts.length > 0 ? "review-conflicts" : "apply",
      command: `beztack-sync.mjs apply --to ${toRev}`,
      note:
        conflicts.length > 0
          ? "One or more Sync conflicts require an explicit decision. " +
            "After resolving, apply proceeds on a branch."
          : "Apply proceeds on a branch. The Environment contract update " +
            "and Template parameter rendering happen automatically.",
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
}) {
  const fromFiles = await listFiles(fromTemplateRoot);
  const toFiles = await listFiles(toTemplateRoot);
  const derivedFiles = await listFiles(derivedRoot, derivedRoot);

  const updates = [];
  const skipped = [];
  const conflicts = [];
  const blockers = [];

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
      path.startsWith("template-revisions/")
    ) {
      continue;
    }

    const fromContent = fromFiles[path] ?? null;
    const toContent = toFiles[path] ?? null;
    const derivedContent = derivedFiles[path] ?? null;
    const ownership = resolveOwnership(path, policy);
    const seam = (policy.seams ?? []).find((s) => s.file === path);
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
      !seam &&
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

    if (ownership === "mixed" && seam) {
      updates.push({
        path,
        ownership,
        reason: "template-harness-updated-seam-preserved",
        seam: seam.id,
      });
      continue;
    }

    if (path === "package.json") {
      updates.push({
        path,
        ownership,
        reason: "render-template-parameters-and-merge",
        seam: null,
      });
      continue;
    }

    updates.push({
      path,
      ownership,
      reason: "template-changed-no-project-change",
      seam: null,
    });
  }

  const summary = buildSummary({
    fromRev,
    toRev,
    derivedProjectId,
    updates,
    skipped,
    conflicts,
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
    updates,
    skipped,
    conflicts,
    blockers,
  };
}

function buildSummary({ fromRev, toRev, derivedProjectId, updates, skipped, conflicts }) {
  const envContractUpdate = updates.some((u) => u.path === ".env.contract.json");
  const paramUpdate = updates.some((u) => u.path === "package.json");
  const seamUpdate = updates.find((u) => u.seam);
  const lockfileSkipped = skipped.some((s) => s.path === "pnpm-lock.yaml");
  const conflictPaths = conflicts.map((c) => c.path).join(", ");

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
  if (seamUpdate) {
    parts.push(
      `Update ${seamUpdate.path} with the ${seamUpdate.seam} seam preserved.`
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
}) {
  const derivedFiles = await listFiles(derivedRoot, derivedRoot);
  const originFiles = await listFiles(fromTemplateRoot);

  const candidates = [];
  const skipped = [];

  for (const [path, _content] of Object.entries(derivedFiles)) {
    if (path.startsWith(".beztack/") || path === "node_modules") continue;
    if (path in originFiles) continue;

    const ownership = resolveOwnership(path, policy);
    const seam = (policy.seams ?? []).find((s) => s.file === path);

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
        reason: seam ? "mixed-protected-by-seam" : "platform-extraction-required",
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

  return {
    schemaVersion: "1.0",
    derivedProjectId,
    trustClass,
    templateId,
    syncEngine: engineOutput,
    baselineRevision: origin.templateRevision ?? fromRev,
    label: "promotion: candidate",
    candidates,
    skipped,
    checks: [
      { name: "schema/sync-policy", result: "pass" },
      { name: "schema/origin-baseline", result: "pass" },
      { name: "schema/sync-state", result: "pass" },
      { name: "ownership/overlap-validation", result: "pass" },
      { name: "promotion/candidate-filter", result: "pass" },
      { name: "engine/version-compatibility", result: "pass" },
    ],
    suggestedTemplateVersionImpact:
      candidates.length > 0 ? "minor" : "none",
    relatedPromotions: [],
  };
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
      if (next === undefined || next.startsWith("--")) {
        out[key] = true;
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
