#!/usr/bin/env node
// @ts-check
/**
 * Beztack Template Sync inspection harness.
 *
 * Read-only. Produces a `Sync inspection report` from a local Derived project
 * checkout against an explicit pair of Template revisions in a Template
 * source. Never mutates the Derived project, never rewrites the Origin
 * baseline, never infers a Template revision from hash-only legacy origin
 * data, and never treats generic CLI tags as Template revisions.
 *
 * The JSON form of the report is primary; a Markdown view is derived on
 * request. The report is evidence only — it does not approve a Template
 * update and does not decide changes are safe to apply.
 *
 * Issue: V473r10/beztack#36
 * Parent PRD: V473r10/beztack#27
 */

import { spawnSync } from "node:child_process";
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

const HARNESS_NAME = "beztack-template-sync-inspect";
const HARNESS_VERSION = "0.1.0";
const REPORT_SCHEMA_VERSION = "1.0";
const COMMIT_HASH_PATTERN = /^[0-9a-f]{7,40}$/;
const WHITESPACE_PATTERN = /\s+/;
const REFS_TAGS_PREFIX = "refs/tags/";
const REFS_HEADS_PREFIX = "refs/heads/";
const SHORT_HASH_LENGTH = 7;

const ARG_DEFINITIONS = {
  "--derived": { key: "derived" },
  "--from": { key: "from" },
  "--to": { key: "to" },
  "--template-source": { key: "templateSource" },
  "--output": { key: "output" },
  "-o": { key: "output" },
  "--help": { key: "help", flag: true },
  "-h": { key: "help", flag: true },
};

const FORMAT_JSON = "json";
const FORMAT_MARKDOWN = "markdown";

const REPORT_GUARANTEES = Object.freeze({
  readOnly: true,
  didNotMutateDerivedProject: true,
  didNotRewriteOriginBaseline: true,
  didNotInferTemplateRevision: true,
  didNotTreatGenericTagsAsTemplateRevisions: true,
  reportIsNotAnApproval: true,
});

const LEGACY_TEMPLATE_MANIFEST_KEYS = new Set([
  "templateId",
  "currentVersion",
  "strategyByPath",
  "customZones",
  "appliedMigrations",
]);

const CURRENT_TEMPLATE_MANIFEST_KEYS = new Set([
  "schemaVersion",
  "templateId",
  "version",
  "semver",
  "releasedAt",
]);

const REVISION_KINDS = {
  MISSING: "missing",
  UNRESOLVABLE: "unresolvable",
  TAG_DISALLOWED: "tag-disallowed",
  EXACT_COMMIT: "exact-commit",
  EXACT_REFS: "exact-refs",
};

const COMPARISON_BASIS_STATUSES = {
  RESOLVED: "resolved",
  PARTIAL: "partial",
  MISSING: "missing",
  TAG_DISALLOWED: "tag-disallowed",
};

const METADATA_SHAPES = {
  CURRENT: "current",
  LEGACY: "legacy",
  MISSING: "missing",
  UNKNOWN: "unknown",
};

const ORIGIN_SHAPES = {
  CURRENT: "current",
  LEGACY_HASH_ONLY: "legacy-hash-only",
  MISSING: "missing",
  UNKNOWN: "unknown",
};

const OWNERSHIP_SHAPES = {
  CURRENT_POLICY: "current-policy",
  PROVISIONAL: "provisional-resolved-from-legacy-strategy-by-path",
  NONE: "none",
};

const FILESYSTEM_SEAM_KINDS = {
  NITRO_FS_ROUTING: "nitro-fs-routing",
};

const CATEGORIES = {
  LOW_RISK: "low-risk-update-candidate",
  REVIEW_REQUIRED: "review-required-update-candidate",
  CUSTOM_PRODUCT: "custom-owned-product-domain",
  MIXED: "mixed-ownership",
  PLATFORM_EXTRACTION: "platform-extraction-candidate",
};

const RISKS = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
};

const GLOB_SPECIFICITY_DOUBLE_STAR_PENALTY = 5;
const GLOB_SPECIFICITY_SINGLE_STAR_PENALTY = 1;
const NPM_NODE_MODULES = "node_modules";
const GIT_DIR_NAME = ".git";
const DEFAULT_BASIS_MISSING_MESSAGE =
  "comparison basis missing; drift cannot be evaluated against a Template update";

class CliUsageError extends Error {}

function usage() {
  return [
    "beztack-template-sync-inspect",
    "",
    "Read-only Template Sync inspection harness. Emits a Sync inspection report",
    "for an explicit pair of Template revisions against a local Derived project",
    "checkout. The JSON form is primary; --markdown emits a derived human view.",
    "",
    "Usage:",
    "  inspect.mjs --derived <path> [--from <rev>] [--to <rev>] [--template-source <path>]",
    "             [--json | --markdown] [--output <path>]",
    "",
    "Required:",
    "  --derived <path>            Path to a local Derived project checkout.",
    "Optional:",
    "  --from <ref|commit>         Explicit Template revision to compare against.",
    "  --to   <ref|commit>         Explicit Template revision to compare to.",
    "  --template-source <path>    Path to a local Template source checkout.",
    "                              Defaults to the current working directory.",
    "  --json                      Emit JSON to stdout (default).",
    "  --markdown                  Emit Markdown to stdout.",
    "  --output <path>             Write to file instead of stdout.",
    "  --help                      Show this message.",
    "",
    "Guarantees:",
    "  Read-only. Never mutates the Derived project, never rewrites",
    "  .beztack/origin.json, never infers a Template revision from hash-only",
    "  legacy origin data, never treats generic CLI tags as Template revisions.",
    "  The report is evidence, not approval.",
  ].join("\n");
}

function emptyOpts() {
  return {
    derived: null,
    from: null,
    to: null,
    templateSource: null,
    format: FORMAT_JSON,
    output: null,
    help: false,
  };
}

function parseArgs(argv) {
  const opts = emptyOpts();
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const def = ARG_DEFINITIONS[a];
    if (def) {
      if (def.flag) {
        opts[def.key] = true;
        continue;
      }
      const next = argv[i + 1];
      if (next === undefined) {
        throw new CliUsageError(`${a} requires a value`);
      }
      opts[def.key] = next;
      i += 1;
      continue;
    }
    if (a === "--json") {
      opts.format = FORMAT_JSON;
      continue;
    }
    if (a === "--markdown") {
      opts.format = FORMAT_MARKDOWN;
      continue;
    }
    positional.push(a);
  }
  if (positional.length > 0) {
    throw new CliUsageError(
      `Unexpected positional arguments: ${positional.join(" ")}`
    );
  }
  return opts;
}

function ensureString(label, value) {
  if (typeof value !== "string" || value.length === 0) {
    throw new CliUsageError(`${label} must be a non-empty string`);
  }
  return value;
}

function resolvePathOrThrow(label, value) {
  ensureString(label, value);
  const abs = resolve(value);
  if (!existsSync(abs)) {
    throw new CliUsageError(`${label} path does not exist: ${abs}`);
  }
  const s = statSync(abs);
  if (!s.isDirectory()) {
    throw new CliUsageError(`${label} path is not a directory: ${abs}`);
  }
  return abs;
}

function readJsonIfExists(absPath) {
  if (!existsSync(absPath)) {
    return { found: false, value: null };
  }
  let raw;
  try {
    raw = readFileSync(absPath, "utf8");
  } catch (err) {
    return { found: true, value: null, error: `unreadable: ${err.message}` };
  }
  try {
    return { found: true, value: JSON.parse(raw) };
  } catch (err) {
    return { found: true, value: null, error: `invalid JSON: ${err.message}` };
  }
}

function runGit(repo, args) {
  return spawnSync("git", ["-C", repo, ...args], { encoding: "utf8" });
}

function gitRevParse(repo, ref) {
  const r = runGit(repo, ["rev-parse", "--verify", ref]);
  if (r.status !== 0) {
    return null;
  }
  return r.stdout.trim();
}

function gitDiffNameOnly(repo, fromCommit, toCommit) {
  if (!(fromCommit && toCommit)) {
    return [];
  }
  const r = runGit(repo, ["diff", "--name-only", `${fromCommit}..${toCommit}`]);
  if (r.status !== 0) {
    return [];
  }
  return r.stdout.split("\n").filter(Boolean);
}

function gitShowRefType(repo, ref) {
  const r = runGit(repo, ["show-ref", "--verify", ref]);
  if (r.status === 0) {
    const parts = r.stdout.trim().split(WHITESPACE_PATTERN);
    return parts.length > 1 ? parts.at(-1) : null;
  }
  const fallback = runGit(repo, ["show-ref", ref]);
  if (fallback.status !== 0) {
    return null;
  }
  const lines = fallback.stdout.trim().split("\n");
  for (const line of lines) {
    const parts = line.split(WHITESPACE_PATTERN);
    const name = parts.at(-1);
    if (
      name === ref ||
      name === `refs/tags/${ref}` ||
      name === `refs/heads/${ref}`
    ) {
      return name;
    }
  }
  return null;
}

function disallowTag(requested, direct) {
  return {
    status: REVISION_KINDS.TAG_DISALLOWED,
    requested,
    resolvedCommit: direct,
    resolvedShort: direct.slice(0, SHORT_HASH_LENGTH),
    rationale:
      "Generic repository tags are not designated Template revisions; pass a commit, branch, or refs/-prefixed ref explicitly.",
  };
}

function makeResolved(requested, status, resolved, extra = {}) {
  return {
    status,
    requested,
    resolvedCommit: resolved,
    resolvedShort: resolved.slice(0, SHORT_HASH_LENGTH),
    ...extra,
  };
}

function resolveTagOrBranchRef(repo, requested) {
  const resolved = gitRevParse(repo, requested);
  if (!resolved) {
    return { status: REVISION_KINDS.UNRESOLVABLE, requested };
  }
  const refType = gitShowRefType(repo, requested);
  const shape = refType || requested;
  return makeResolved(requested, REVISION_KINDS.EXACT_REFS, resolved, {
    resolvedRef: shape,
  });
}

function resolveBareName(repo, requested) {
  const direct = gitRevParse(repo, requested);
  if (!direct) {
    return { status: REVISION_KINDS.UNRESOLVABLE, requested };
  }
  const refType = gitShowRefType(repo, requested);
  if (refType?.startsWith(REFS_TAGS_PREFIX)) {
    return disallowTag(requested, direct);
  }
  if (refType?.startsWith(REFS_HEADS_PREFIX)) {
    return makeResolved(requested, REVISION_KINDS.EXACT_REFS, direct, {
      resolvedRef: refType,
    });
  }
  if (refType) {
    return makeResolved(requested, REVISION_KINDS.EXACT_REFS, direct, {
      resolvedRef: refType,
    });
  }
  return makeResolved(requested, REVISION_KINDS.EXACT_COMMIT, direct);
}

function resolveTemplateRevision(repo, requested) {
  if (!requested) {
    return { status: REVISION_KINDS.MISSING };
  }
  if (COMMIT_HASH_PATTERN.test(requested)) {
    const resolved = gitRevParse(repo, requested);
    if (!resolved) {
      return { status: REVISION_KINDS.UNRESOLVABLE, requested };
    }
    return makeResolved(requested, REVISION_KINDS.EXACT_COMMIT, resolved);
  }
  if (requested.startsWith("refs/")) {
    return resolveTagOrBranchRef(repo, requested);
  }
  return resolveBareName(repo, requested);
}

function legacyTemplateMessage() {
  return "beztack.template.json uses the legacy shape (templateId, currentVersion, strategyByPath, customZones, appliedMigrations); recorded as 'Legacy sync metadata', not 'corrupt manifest'.";
}

function currentTemplateMessage() {
  return "beztack.template.json uses the current manifest shape (schemaVersion, version, semver).";
}

function legacyOriginMessage() {
  return ".beztack/origin.json is hash-only legacy Origin baseline (projectHash/templateHash per file); recorded as 'Legacy sync metadata'. The harness does not infer a Template revision from hash-only legacy data and does not rewrite it.";
}

function classifyManifestShape(keys) {
  const hasLegacy = [...LEGACY_TEMPLATE_MANIFEST_KEYS].some((k) =>
    keys.includes(k)
  );
  const hasCurrent = [...CURRENT_TEMPLATE_MANIFEST_KEYS].every((k) =>
    keys.includes(k)
  );
  if (hasCurrent && !hasLegacy) {
    return METADATA_SHAPES.CURRENT;
  }
  if (hasLegacy) {
    return METADATA_SHAPES.LEGACY;
  }
  return METADATA_SHAPES.UNKNOWN;
}

function classifyOriginShape(origin) {
  if (!origin) {
    return ORIGIN_SHAPES.MISSING;
  }
  const top = Object.keys(origin);
  if (!top.includes("files")) {
    return ORIGIN_SHAPES.MISSING;
  }
  const fileKeys =
    typeof origin.files === "object" ? Object.keys(origin.files) : [];
  if (fileKeys.length === 0) {
    return ORIGIN_SHAPES.UNKNOWN;
  }
  const sample = origin.files[fileKeys[0]];
  if (!sample || typeof sample !== "object") {
    return ORIGIN_SHAPES.UNKNOWN;
  }
  const sampleKeys = Object.keys(sample);
  const onlyHashes =
    sampleKeys.length > 0 &&
    sampleKeys.length <= 2 &&
    sampleKeys.every((k) => k === "projectHash" || k === "templateHash");
  if (onlyHashes) {
    return ORIGIN_SHAPES.LEGACY_HASH_ONLY;
  }
  return ORIGIN_SHAPES.CURRENT;
}

function inspectManifest(absDerived) {
  const observations = [];
  const manifest = readJsonIfExists(`${absDerived}/beztack.template.json`);
  let manifestShape = METADATA_SHAPES.MISSING;
  let isLegacySyncMetadata = false;
  let manifestPresent = false;

  if (!(manifest.found && manifest.value)) {
    if (manifest.found && manifest.error) {
      observations.push(`beztack.template.json ${manifest.error}`);
    } else {
      observations.push("beztack.template.json is absent.");
    }
    return {
      manifestShape,
      manifestPresent,
      isLegacySyncMetadata,
      observations,
    };
  }

  manifestPresent = true;
  manifestShape = classifyManifestShape(Object.keys(manifest.value));
  if (manifestShape === METADATA_SHAPES.CURRENT) {
    observations.push(currentTemplateMessage());
  } else if (manifestShape === METADATA_SHAPES.LEGACY) {
    isLegacySyncMetadata = true;
    observations.push(legacyTemplateMessage());
    if (manifest.value.currentVersion && !manifest.value.schemaVersion) {
      observations.push(
        "currentVersion is a legacy CLI version field; do not treat it as a Template revision."
      );
    }
    if (
      Array.isArray(manifest.value.appliedMigrations) &&
      manifest.value.appliedMigrations.length === 0
    ) {
      observations.push(
        "appliedMigrations is empty; no migrations have been declared against the current Template policy."
      );
    }
  } else {
    observations.push(
      "beztack.template.json shape is neither current nor legacy; review manually."
    );
  }
  return { manifestShape, manifestPresent, isLegacySyncMetadata, observations };
}

function inspectOrigin(absDerived) {
  const observations = [];
  const origin = readJsonIfExists(`${absDerived}/.beztack/origin.json`);
  let originShape = ORIGIN_SHAPES.MISSING;
  let isHashOnlyOrigin = false;
  let isLegacySyncMetadata = false;
  let originPresent = false;

  if (!(origin.found && origin.value)) {
    if (origin.found && origin.error) {
      observations.push(`.beztack/origin.json ${origin.error}`);
    } else {
      observations.push(".beztack/origin.json is absent.");
    }
    return {
      originShape,
      originPresent,
      isHashOnlyOrigin,
      isLegacySyncMetadata,
      observations,
    };
  }

  originPresent = true;
  originShape = classifyOriginShape(origin.value);
  if (originShape === ORIGIN_SHAPES.LEGACY_HASH_ONLY) {
    isHashOnlyOrigin = true;
    isLegacySyncMetadata = true;
    observations.push(legacyOriginMessage());
  } else if (originShape === ORIGIN_SHAPES.CURRENT) {
    observations.push(
      ".beztack/origin.json uses the current Origin baseline shape; the harness treats the recorded values as evidence, not as approval."
    );
  } else if (originShape === ORIGIN_SHAPES.UNKNOWN) {
    observations.push(
      ".beztack/origin.json files section is present but its shape is not recognised; review manually."
    );
  }
  return {
    originShape,
    originPresent,
    isHashOnlyOrigin,
    isLegacySyncMetadata,
    observations,
  };
}

function inspectDerivedMetadata(absDerived) {
  const manifestResult = inspectManifest(absDerived);
  const originResult = inspectOrigin(absDerived);
  return {
    templateManifestPath: "beztack.template.json",
    originBaselinePath: ".beztack/origin.json",
    manifestShape: manifestResult.manifestShape,
    originShape: originResult.originShape,
    manifestPresent: manifestResult.manifestPresent,
    originPresent: originResult.originPresent,
    isLegacySyncMetadata:
      manifestResult.isLegacySyncMetadata || originResult.isLegacySyncMetadata,
    isHashOnlyOrigin: originResult.isHashOnlyOrigin,
    legacyObservations: [
      ...manifestResult.observations,
      ...originResult.observations,
    ],
    templateRevisionInferredFromOrigin: false,
  };
}

function inspectDerivedGit(absDerived) {
  if (!existsSync(`${absDerived}/.git`)) {
    return { branch: null, headCommit: null, isGitRepo: false };
  }
  const branch = runGit(absDerived, ["branch", "--show-current"]);
  const head = runGit(absDerived, ["rev-parse", "HEAD"]);
  if (branch.status !== 0 || head.status !== 0) {
    return { branch: null, headCommit: null, isGitRepo: true };
  }
  return {
    isGitRepo: true,
    branch: branch.stdout.trim(),
    headCommit: head.stdout.trim(),
  };
}

function globToRegex(pattern) {
  let escaped = "";
  let i = 0;
  while (i < pattern.length) {
    const c = pattern[i];
    if (c === "*" && pattern[i + 1] === "*") {
      escaped += ".*";
      i += 2;
      if (pattern[i] === "/") {
        escaped += "/";
        i += 1;
      }
      continue;
    }
    if (c === "*") {
      escaped += "[^/]*";
      i += 1;
      continue;
    }
    if (c === "?") {
      escaped += "[^/]";
      i += 1;
      continue;
    }
    if (".+^$()|{}[]\\".includes(c)) {
      escaped += `\\${c}`;
      i += 1;
      continue;
    }
    escaped += c;
    i += 1;
  }
  return new RegExp(`^${escaped}$`);
}

function consumeGlobMatch(pattern, i) {
  const c = pattern[i];
  if (c === "*" && pattern[i + 1] === "*") {
    let next = i + 2;
    if (pattern[next] === "/") {
      next += 1;
    }
    return { score: -GLOB_SPECIFICITY_DOUBLE_STAR_PENALTY, segments: 0, next };
  }
  if (c === "*") {
    return {
      score: -GLOB_SPECIFICITY_SINGLE_STAR_PENALTY,
      segments: 0,
      next: i + 1,
    };
  }
  if (c === "?") {
    return { score: 0, segments: 0, next: i + 1 };
  }
  return consumeLiteralSegment(pattern, i);
}

function consumeLiteralSegment(pattern, i) {
  let end = i;
  while (
    end < pattern.length &&
    pattern[end] !== "/" &&
    pattern[end] !== "*" &&
    pattern[end] !== "?"
  ) {
    end += 1;
  }
  const segments = pattern[end] === "/" ? 2 : 1;
  const next = pattern[end] === "/" ? end + 1 : end;
  return { score: end - i, segments, next };
}

function globSpecificity(pattern) {
  let score = 0;
  let segments = 0;
  let i = 0;
  while (i < pattern.length) {
    const consumed = consumeGlobMatch(pattern, i);
    score += consumed.score;
    segments += consumed.segments;
    i = consumed.next;
  }
  return { score, segments };
}

function compareSpecificityDesc(a, b) {
  const sa = globSpecificity(a.pattern).score;
  const sb = globSpecificity(b.pattern).score;
  if (sa !== sb) {
    return sb - sa;
  }
  return (
    globSpecificity(b.pattern).segments - globSpecificity(a.pattern).segments
  );
}

function resolveOwnership(legacyRules, targetPath) {
  if (!legacyRules || typeof legacyRules !== "object") {
    return null;
  }
  const matches = [];
  for (const [pattern, strategy] of Object.entries(legacyRules)) {
    if (globToRegex(pattern).test(targetPath)) {
      matches.push({ pattern, strategy });
    }
  }
  if (matches.length === 0) {
    return null;
  }

  matches.sort(compareSpecificityDesc);

  const top = matches[0];
  const topScore = globSpecificity(top.pattern).score;
  const sameTop = matches.filter(
    (m) => globSpecificity(m.pattern).score === topScore
  );

  return {
    strategy: top.strategy,
    confidence: sameTop.length > 1 ? "overlap" : "specific-match",
    matchedRule: top.pattern,
    contenders: sameTop.map((m) => m.pattern),
    allMatches: matches.map((m) => m.pattern),
  };
}

function countFilesRecursive(root) {
  let count = 0;
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = `${dir}/${name}`;
      const s = statSync(p);
      if (s.isDirectory()) {
        walk(p);
      } else {
        count += 1;
      }
    }
  };
  walk(root);
  return count;
}

function detectFilesystemSyncSeams(absDerived) {
  const seams = [];
  const nitroRoot = `${absDerived}/apps/api/server/routes`;
  if (existsSync(nitroRoot) && statSync(nitroRoot).isDirectory()) {
    seams.push({
      kind: FILESYSTEM_SEAM_KINDS.NITRO_FS_ROUTING,
      root: "apps/api/server/routes",
      evidence: "directory-tree",
      observation:
        "Nitro filesystem routing uses reserved route directories under apps/api/server/routes/**; treat new files there as Candidates for Filesystem sync seam analysis, not edits to a central routes.ts registry.",
      fileCount: countFilesRecursive(nitroRoot),
    });
  }
  return seams;
}

function collectObservedFiles(absDerived) {
  const result = [];
  const walk = (rel, abs) => {
    for (const entry of readdirSync(abs)) {
      const childRel = rel ? `${rel}/${entry}` : entry;
      if (entry === GIT_DIR_NAME || entry === NPM_NODE_MODULES) {
        continue;
      }
      const childAbs = `${abs}/${entry}`;
      const s = statSync(childAbs);
      if (s.isDirectory()) {
        walk(childRel, childAbs);
      } else {
        result.push(childRel);
      }
    }
  };
  walk("", absDerived);
  return result;
}

function driftBasisMessage(fromHash, toHash) {
  if (fromHash && toHash) {
    return `${fromHash.slice(0, SHORT_HASH_LENGTH)}..${toHash.slice(0, SHORT_HASH_LENGTH)} on filesystem`;
  }
  return DEFAULT_BASIS_MISSING_MESSAGE;
}

function ownershipShapeFor(metadataShape) {
  if (metadataShape === METADATA_SHAPES.CURRENT) {
    return OWNERSHIP_SHAPES.CURRENT_POLICY;
  }
  if (metadataShape === METADATA_SHAPES.LEGACY) {
    return OWNERSHIP_SHAPES.PROVISIONAL;
  }
  return OWNERSHIP_SHAPES.NONE;
}

function ownershipNoteFor(metadataShape) {
  if (metadataShape === METADATA_SHAPES.LEGACY) {
    return "Ownership classifications are Provisional ownership resolution from Legacy sync metadata; report overlaps and confidence limits.";
  }
  if (metadataShape === METADATA_SHAPES.CURRENT) {
    return "Ownership classifications follow the declared Sync policy.";
  }
  return "No Sync policy or legacy strategy is available; ownership evidence is empty.";
}

function determineComparisonBasisStatus(fromResolution, toResolution, opts) {
  const fromOk = isResolved(fromResolution.status);
  const toOk = isResolved(toResolution.status);
  if (fromOk && toOk) {
    return COMPARISON_BASIS_STATUSES.RESOLVED;
  }
  if (
    fromResolution.status === REVISION_KINDS.MISSING &&
    toResolution.status === REVISION_KINDS.MISSING &&
    opts.from === null &&
    opts.to === null
  ) {
    return COMPARISON_BASIS_STATUSES.MISSING;
  }
  if (
    fromResolution.status === REVISION_KINDS.TAG_DISALLOWED ||
    toResolution.status === REVISION_KINDS.TAG_DISALLOWED
  ) {
    return COMPARISON_BASIS_STATUSES.TAG_DISALLOWED;
  }
  return COMPARISON_BASIS_STATUSES.PARTIAL;
}

function isResolved(status) {
  return (
    status === REVISION_KINDS.EXACT_COMMIT ||
    status === REVISION_KINDS.EXACT_REFS
  );
}

function comparisonBasisNote(status) {
  if (status === COMPARISON_BASIS_STATUSES.MISSING) {
    return "A missing or unresolvable --from means a complete Template diff is not available; classification below uses ownership and seam evidence only.";
  }
  if (status === COMPARISON_BASIS_STATUSES.PARTIAL) {
    return "Either --from or --to was not resolvable to an explicit Template revision; partial evidence only.";
  }
  if (status === COMPARISON_BASIS_STATUSES.TAG_DISALLOWED) {
    return "A generic CLI tag was passed; the harness records it as evidence but treats the comparison basis as not authoritative until --from/--to are passed as commits, branches, or refs/ refs.";
  }
  return "Both --from and --to resolved to explicit Template revisions.";
}

function classifyCandidate(relPath, ownership, drift, seamHints) {
  const driftLabel = describeDrift(drift);
  const isOverlap = ownership?.confidence === "overlap";
  const isSeamMember = seamHints.length > 0;

  const baseReasons = [];
  if (isOverlap) {
    baseReasons.push(
      "Provisional ownership resolution matched multiple legacy rules with equal specificity; classification carries overlap evidence."
    );
  }

  const strategy = classifyStrategy(ownership, drift, isSeamMember);
  return emitCandidate(
    {
      strategy,
      relPath,
      ownership,
      drift,
      seamHints,
      driftLabel,
      isSeamMember,
    },
    baseReasons
  );
}

function describeDrift(drift) {
  const reasons = [];
  if (drift.templateChanged) {
    reasons.push("Template changed");
  }
  if (drift.derivedProjectChanged) {
    reasons.push("Derived project changed");
  }
  return reasons.length > 0 ? reasons.join(" and ") : "no observed drift";
}

function isDriftFree(drift) {
  if (drift.templateChanged) {
    return false;
  }
  if (drift.derivedProjectChanged) {
    return false;
  }
  return true;
}

function classifyStrategy(ownership, drift, isSeamMember) {
  switch (ownership?.strategy) {
    case "custom-owned":
      return "custom";
    case "template-owned": {
      if (isDriftFree(drift)) {
        return "low-risk-template";
      }
      return "review-template";
    }
    case "mixed":
      return "mixed";
    default:
      if (isSeamMember) {
        return "platform-extraction";
      }
      return "unresolved";
  }
}

const CANDIDATE_CATEGORY = {
  custom: CATEGORIES.CUSTOM_PRODUCT,
  "low-risk-template": CATEGORIES.LOW_RISK,
  "review-template": CATEGORIES.REVIEW_REQUIRED,
  mixed: CATEGORIES.MIXED,
  "platform-extraction": CATEGORIES.PLATFORM_EXTRACTION,
  unresolved: CATEGORIES.REVIEW_REQUIRED,
};

function candidateReasonFor(strategy, driftLabel, isSeamMember) {
  switch (strategy) {
    case "custom":
      return "Provisional ownership is custom-owned (Product domain evidence).";
    case "low-risk-template":
      return "Template-owned with no observed Template or Derived project drift.";
    case "review-template":
      return `Template-owned with observed drift (${driftLabel}).`;
    case "mixed":
      return describeMixedReasons(isSeamMember)[0];
    case "platform-extraction":
      return "Path lies inside an observed Filesystem sync seam but has no clear ownership yet; review for Platform extraction design.";
    default:
      return "No ownership evidence was resolvable from legacy metadata.";
  }
}

function candidateCheckFor(strategy) {
  switch (strategy) {
    case "custom":
      return "Confirm the path is still Product domain-owned and not a candidate for Platform extraction.";
    case "low-risk-template":
      return "Run the standard Template-owned review-and-check path.";
    case "review-template":
      return "Review the Template diff for any customisations the Derived project depends on.";
    case "mixed":
      return "Decide whether the path belongs to a Sync seam, a custom zone, or an explicit conflict rule.";
    case "platform-extraction":
      return "Decide whether the Filesystem sync seam should be promoted to a Template source framework convention.";
    default:
      return "Decide whether to add explicit ownership coverage in a future Sync policy version.";
  }
}

function candidateActionFor(strategy, relPath) {
  switch (strategy) {
    case "custom":
      return `Keep ${relPath} under Product domain ownership; do not propose a Template-owned update.`;
    case "low-risk-template":
      return `When --to lands a real change at ${relPath}, include it in the next Template update review as a low-risk candidate.`;
    case "review-template":
      return `Open a Template update review entry for ${relPath} with a concrete diff excerpt and ownership rationale.`;
    case "mixed":
      return `Present trade-offs for ${relPath}; ask the reviewer for an explicit ownership/seam decision before any update.`;
    case "platform-extraction":
      return `Open a Platform extraction design review for the surrounding Filesystem sync seam before promoting ${relPath}.`;
    default:
      return `Mark ${relPath} as Review-required until ownership is clarified.`;
  }
}

function candidateRiskFor(strategy) {
  switch (strategy) {
    case "custom":
    case "low-risk-template":
      return RISKS.LOW;
    case "review-template":
    case "platform-extraction":
      return RISKS.MEDIUM;
    default:
      return RISKS.HIGH;
  }
}

function emitCandidate(ctx, baseReasons) {
  return candidateResult({
    path: ctx.relPath,
    ownership: ctx.ownership,
    drift: ctx.drift,
    seamHints: ctx.seamHints,
    category: CANDIDATE_CATEGORY[ctx.strategy],
    reasons: baseReasons.concat([
      candidateReasonFor(ctx.strategy, ctx.driftLabel, ctx.isSeamMember),
    ]),
    suggestedChecks: [candidateCheckFor(ctx.strategy)],
    nextActions: [
      newAction(
        candidateActionFor(ctx.strategy, ctx.relPath),
        candidateRiskFor(ctx.strategy)
      ),
    ],
  });
}

function describeMixedReasons(isSeamMember) {
  if (isSeamMember) {
    return [
      "Mixed-ownership path sits inside an observed Filesystem sync seam; the harness recommends Filesystem sync seam handling over a central registry seam.",
    ];
  }
  return [
    "Mixed-ownership path requires seam analysis or explicit conflict handling.",
  ];
}

function newAction(label, risk) {
  return { label, risk, requiresApproval: true };
}

function candidateResult({
  path,
  ownership,
  drift,
  seamHints,
  category,
  reasons,
  suggestedChecks,
  nextActions,
}) {
  return {
    path,
    category,
    ownership,
    seamHints,
    drift,
    reasons,
    suggestedChecks,
    nextActions,
  };
}

function countByStrategy(candidates) {
  const counts = {
    "custom-owned": 0,
    "template-owned": 0,
    mixed: 0,
    unresolved: 0,
  };
  for (const c of candidates) {
    const s = c.ownership?.strategy;
    if (s === "custom-owned") {
      counts["custom-owned"] += 1;
    } else if (s === "template-owned") {
      counts["template-owned"] += 1;
    } else if (s === "mixed") {
      counts.mixed += 1;
    } else {
      counts.unresolved += 1;
    }
  }
  return counts;
}

function summariseCandidates(candidates, metadata) {
  const byCategory = {};
  for (const c of candidates) {
    byCategory[c.category] = (byCategory[c.category] || 0) + 1;
  }
  return {
    filesObserved: candidates.length,
    candidatesByCategory: byCategory,
    legacyObservations: metadata.legacyObservations,
  };
}

function maybeBaselineResetAction(metadata) {
  if (!metadata.isHashOnlyOrigin) {
    return null;
  }
  return newAction(
    "Decide whether the hash-only .beztack/origin.json should be normalised; the harness never rewrites it implicitly. A Baseline reset must be reviewed and explicitly accepted.",
    RISKS.MEDIUM
  );
}

function maybeMigrateManifestAction(metadata) {
  if (metadata.manifestShape !== METADATA_SHAPES.LEGACY) {
    return null;
  }
  return newAction(
    "Migrate beztack.template.json to the current Sync policy shape (schemaVersion, version, semver); treat the current shape as Legacy sync metadata.",
    RISKS.LOW
  );
}

function maybeReviewRequiredAction(summary) {
  const count = summary.candidatesByCategory[CATEGORIES.REVIEW_REQUIRED] || 0;
  if (count === 0) {
    return null;
  }
  return newAction(
    "Walk reviewer-required candidates one at a time; ask for an explicit decision per candidate before any mutation.",
    RISKS.HIGH
  );
}

function maybePlatformExtractionAction(summary) {
  const count =
    summary.candidatesByCategory[CATEGORIES.PLATFORM_EXTRACTION] || 0;
  if (count === 0) {
    return null;
  }
  return newAction(
    "Open a Platform extraction design review for any candidate classified as Platform extraction before promoting it.",
    RISKS.MEDIUM
  );
}

function buildSuggestedActions(summary, metadata) {
  return [
    maybeBaselineResetAction(metadata),
    maybeMigrateManifestAction(metadata),
    maybeReviewRequiredAction(summary),
    maybePlatformExtractionAction(summary),
    newAction(
      "Persist only Structural sync evidence from this run; do not copy full reports, code, secrets, or Product domain data into the Template source.",
      RISKS.LOW
    ),
  ].filter((a) => a !== null);
}

function buildReport(opts) {
  const absDerived = resolvePathOrThrow("--derived", opts.derived);

  const gitInfo = inspectDerivedGit(absDerived);
  const metadata = inspectDerivedMetadata(absDerived);

  const templateSource = opts.templateSource
    ? resolvePathOrThrow("--template-source", opts.templateSource)
    : process.cwd();

  const fromResolution = resolveTemplateRevision(templateSource, opts.from);
  const toResolution = resolveTemplateRevision(templateSource, opts.to);
  const comparisonBasisStatus = determineComparisonBasisStatus(
    fromResolution,
    toResolution,
    opts
  );

  const fromForDiff = fromResolution.resolvedCommit || null;
  const toForDiff = toResolution.resolvedCommit || null;

  const templateChangedPaths =
    fromForDiff && toForDiff
      ? gitDiffNameOnly(templateSource, fromForDiff, toForDiff)
      : [];

  const legacyRules = readJsonIfExists(`${absDerived}/beztack.template.json`)
    .value?.strategyByPath;

  const seams = detectFilesystemSyncSeams(absDerived);

  const customZones = readJsonIfExists(`${absDerived}/beztack.template.json`)
    .value?.customZones;

  const observedFiles = collectObservedFiles(absDerived);

  const candidates = observedFiles.map((relPath) => {
    const ownership = resolveOwnership(legacyRules, relPath);
    const seamHints = seams.filter((s) => relPath.startsWith(s.root));
    const drift = {
      derivedProjectChanged: false,
      templateChanged: templateChangedPaths.includes(relPath),
      basis: driftBasisMessage(fromForDiff, toForDiff),
    };
    return classifyCandidate(relPath, ownership, drift, seamHints);
  });

  const summary = summariseCandidates(candidates, metadata);

  const report = {
    schemaVersion: REPORT_SCHEMA_VERSION,
    harness: { name: HARNESS_NAME, version: HARNESS_VERSION },
    generatedAt: new Date().toISOString(),
    derivedProject: {
      path: absDerived,
      isGitRepo: gitInfo.isGitRepo,
      branch: gitInfo.branch,
      headCommit: gitInfo.headCommit,
      metadata,
    },
    comparisonBasis: {
      status: comparisonBasisStatus,
      templateSource: { path: templateSource },
      from: fromResolution,
      to: toResolution,
      note: comparisonBasisNote(comparisonBasisStatus),
    },
    ownership: {
      shape: ownershipShapeFor(metadata.manifestShape),
      rulesEvaluated: legacyRules ? Object.keys(legacyRules).length : 0,
      overlapsCount: candidates.filter(
        (c) => c.ownership?.confidence === "overlap"
      ).length,
      ruleCountByStrategy: countByStrategy(candidates),
      customZones: customZones || null,
      seams,
      note: ownershipNoteFor(metadata.manifestShape),
    },
    candidates,
    summary,
    suggestedNextActions: buildSuggestedActions(summary, metadata),
    guarantees: REPORT_GUARANTEES,
  };

  return report;
}

function renderMarkdown(report) {
  const lines = [
    `# ${HARNESS_NAME} — Sync inspection report`,
    "",
    `- schemaVersion: \`${report.schemaVersion}\``,
    `- harness: \`${report.harness.name}@${report.harness.version}\``,
    `- generatedAt: ${report.generatedAt}`,
    `- derivedProject: \`${report.derivedProject.path}\``,
    `- branch: \`${report.derivedProject.branch || "not a git repo"}\`, head: \`${report.derivedProject.headCommit?.slice(0, SHORT_HASH_LENGTH) || "n/a"}\``,
    "",
    ...renderMetadataSection(report.derivedProject.metadata),
    ...renderComparisonBasisSection(report.comparisonBasis),
    ...renderOwnershipSection(report.ownership),
    ...renderCandidatesSection(report),
    ...renderActionsSection(report.suggestedNextActions),
    ...renderGuaranteesSection(report.guarantees),
    ">",
    "> This report is Structural sync evidence. It is not approval and does not authorise mutation of the Derived project or its Origin baseline.",
    "",
  ];
  return lines.join("\n");
}

function renderMetadataSection(metadata) {
  const lines = ["## Metadata shape"];
  for (const obs of metadata.legacyObservations) {
    lines.push(`- ${obs}`);
  }
  lines.push("");
  return lines;
}

function renderComparisonBasisSection(basis) {
  return [
    "## Comparison basis",
    `- status: \`${basis.status}\``,
    `- templateSource: \`${basis.templateSource.path}\``,
    `- --from resolution: ${JSON.stringify(basis.from)}`,
    `- --to   resolution: ${JSON.stringify(basis.to)}`,
    `- note: ${basis.note}`,
    "",
  ];
}

function renderOwnershipSection(ownership) {
  const lines = [
    "## Ownership",
    `- shape: \`${ownership.shape}\``,
    `- rulesEvaluated: ${ownership.rulesEvaluated}`,
    `- overlaps: ${ownership.overlapsCount}`,
    `- ruleCountByStrategy: \`${JSON.stringify(ownership.ruleCountByStrategy)}\``,
  ];
  if (ownership.seams.length > 0) {
    lines.push("- Filesystem sync seams observed:");
    for (const s of ownership.seams) {
      lines.push(
        `  - ${s.kind} at \`${s.root}\` (${s.fileCount} files) — ${s.observation}`
      );
    }
  } else {
    lines.push("- No Filesystem sync seams detected.");
  }
  lines.push(`- note: ${ownership.note}`);
  lines.push("");
  return lines;
}

function renderCandidatesSection(report) {
  const lines = [
    "## Candidates",
    `Files observed: ${report.summary.filesObserved}`,
    "",
    "| Category | Count |",
    "| --- | --- |",
  ];
  for (const [cat, n] of Object.entries(report.summary.candidatesByCategory)) {
    lines.push(`| ${cat} | ${n} |`);
  }
  lines.push("");
  lines.push("<details><summary>Per-file candidates</summary>");
  lines.push("");
  for (const c of report.candidates) {
    lines.push(renderCandidateBlock(c));
  }
  lines.push("");
  lines.push("</details>");
  lines.push("");
  return lines;
}

function renderCandidateBlock(c) {
  const lines = [`### \`${c.path}\``, `- category: \`${c.category}\``];
  lines.push(
    `- ownership: \`${c.ownership?.strategy || "unresolved"}\` (confidence: ${c.ownership?.confidence || "n/a"}, rule: ${c.ownership?.matchedRule || "n/a"})`
  );
  lines.push(`- drift: ${JSON.stringify(c.drift)}`);
  for (const r of c.reasons) {
    lines.push(`- reason: ${r}`);
  }
  return lines.join("\n");
}

function renderActionsSection(actions) {
  const lines = ["## Suggested next actions (all require explicit approval)"];
  for (const a of actions) {
    lines.push(`- [risk:${a.risk}] ${a.label}`);
  }
  lines.push("");
  return lines;
}

function renderGuaranteesSection(guarantees) {
  const lines = ["## Guarantees"];
  for (const [k, v] of Object.entries(guarantees)) {
    lines.push(`- ${k}: ${v}`);
  }
  lines.push("");
  return lines;
}

function dispatch(report, opts) {
  const body =
    opts.format === FORMAT_MARKDOWN
      ? renderMarkdown(report)
      : `${JSON.stringify(report, null, 2)}\n`;
  if (opts.output) {
    writeFileSync(opts.output, body);
    process.stdout.write(`wrote ${opts.output}\n`);
    return;
  }
  process.stdout.write(body);
}

function runWithArgs(argv) {
  const opts = parseArgs(argv);
  if (opts.help) {
    console.log(usage());
    return 0;
  }
  if (!opts.derived) {
    console.error("error: --derived is required");
    console.error("");
    console.error(usage());
    return 2;
  }
  let report;
  try {
    report = buildReport(opts);
  } catch (err) {
    if (err instanceof CliUsageError) {
      console.error(`error: ${err.message}`);
      return 2;
    }
    throw err;
  }
  dispatch(report, opts);
  return 0;
}

try {
  const exitCode = runWithArgs(process.argv.slice(2));
  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
} catch (err) {
  console.error(`error: ${err.message}`);
  process.exitCode = 1;
}
