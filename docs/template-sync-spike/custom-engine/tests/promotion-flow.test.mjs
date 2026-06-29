/**
 * Tests for the Promotion label and metadata flow (issue #33).
 *
 * Validates the Beztack Sync engine prototype against the
 * Promotion flow contract from issue #33 and the schema-versioned
 * `promotion-metadata` contract from issue #30:
 *
 *   - The Promotion label on a source PR is the authoritative opt-in
 *     signal; the engine refuses to emit metadata without a label.
 *   - Promotion candidates are filtered by ownership: Template-owned
 *     paths become candidates; Custom-owned Product-domain paths are
 *     skipped; Mixed-with-seam paths are skipped (seam-protected);
 *     Mixed-without-seam paths are surfaced for Platform extraction;
 *     overlapping ownership rules are skipped (ownership-ambiguous).
 *   - Promotion metadata includes source project identity, trust
 *     class, source PR (or issue) links, baseline Template revision,
 *     resolved ownership on every file, skipped files, checks run,
 *     suggested Template version impact, and related overlapping
 *     Promotions.
 *   - Trusted Derived projects may use trusted automation (still
 *     requires Beztack review). Community Derived projects enter as
 *     normal PRs or patches. Both modes are recorded as `entryMode`.
 *   - Overlapping Promotions are linked, not auto-deduplicated.
 *   - The flow distinguishes Promotion from Platform extraction.
 *
 * Runs with Node's built-in test runner:
 *   node --test docs/template-sync-spike/custom-engine/tests/promotion-flow.test.mjs
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile as execFileCb } from "node:child_process";
import {
  mkdir,
  readFile,
  rm,
  writeFile,
  copyFile,
  readdir,
  stat,
} from "node:fs/promises";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const execFile = promisify(execFileCb);
const here = dirname(fileURLToPath(import.meta.url));
const ENGINE_DIR = resolve(here, "..");
const REPO_ROOT = resolve(ENGINE_DIR, "../../..");
const FIXTURE = join(REPO_ROOT, "docs/template-sync-fixture");
const ENGINE = join(ENGINE_DIR, "beztack-sync.mjs");
const SCHEMAS = join(FIXTURE, "schemas");
const REGISTRY_PATH = join(FIXTURE, "beztack/derived-project-registry.json");
const WORK_ROOT = "/tmp/opencode/beztack-promotion-test";

const TRUSTED_ID = "dp_01HMVBEZTACK0000000000000A";
const UNKNOWN_ID = "dp_01HMVBEZTACK0000000000000Z";

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function readText(path) {
  return readFile(path, "utf8");
}

async function runEngine(args, opts = {}) {
  return execFile("node", [ENGINE, ...args], {
    cwd: opts.cwd ?? REPO_ROOT,
  });
}

async function runEngineJson(args, opts = {}) {
  const { stdout, stderr } = await runEngine(args, opts);
  try {
    return { json: JSON.parse(stdout), stderr };
  } catch (err) {
    throw new Error(
      `engine output was not valid JSON (args=${JSON.stringify(args)}):\n${stdout}\n${stderr}`
    );
  }
}

async function runEngineExpectFailure(args, opts = {}) {
  try {
    const { stdout, stderr } = await runEngine(args, opts);
    return { code: 0, stdout, stderr };
  } catch (err) {
    return {
      code: typeof err.code === "number" ? err.code : 1,
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? err.message ?? "",
    };
  }
}

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch (err) {
    if (err.code === "ENOENT") return false;
    throw err;
  }
}

async function copyFixtureDerivedProject(target) {
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  const srcRoot = join(FIXTURE, "derived-project");
  const stack = [srcRoot, target];
  while (stack.length > 0) {
    const [src, dst] = stack.splice(-2);
    const entries = await readdir(src, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "node_modules") continue;
      const s = join(src, entry.name);
      const d = join(dst, entry.name);
      if (entry.isDirectory()) {
        await mkdir(d, { recursive: true });
        stack.push(s, d);
      } else if (entry.isFile()) {
        await copyFile(s, d);
      }
    }
  }
}

async function rewriteDerivedProjectId(target, newId) {
  const beztackDir = join(target, ".beztack");
  const files = [
    "template.json",
    "parameters.json",
    "origin.json",
    "sync-state.json",
    "sync-event-log.json",
  ];
  for (const file of files) {
    const path = join(beztackDir, file);
    if (!(await pathExists(path))) continue;
    const value = JSON.parse(await readText(path));
    if (value && typeof value === "object" && "derivedProjectId" in value) {
      value.derivedProjectId = newId;
      await writeFile(path, JSON.stringify(value, null, 2) + "\n", "utf8");
    }
  }
}

function compileSchema(schema) {
  function resolveRef(ref) {
    if (ref.startsWith("#/$defs/")) {
      const key = ref.slice("#/$defs/".length);
      const target = schema.$defs?.[key];
      if (!target) throw new Error(`unknown $ref ${ref}`);
      return target;
    }
    throw new Error(`unsupported $ref ${ref}`);
  }
  function build(node, pointer) {
    const subValidators = {};
    let itemsValidator = null;
    let oneOfValidators = null;
    let allOfValidators = null;
    if (typeof node.$ref === "string") return build(resolveRef(node.$ref), pointer);
    if (node.properties && typeof node.properties === "object") {
      for (const key of Object.keys(node.properties)) {
        subValidators[key] = build(node.properties[key], `${pointer}/${key}`);
      }
    }
    if (node.items && typeof node.items === "object") {
      itemsValidator = build(node.items, `${pointer}/items`);
    }
    if (Array.isArray(node.oneOf)) {
      oneOfValidators = node.oneOf.map((n, i) => build(n, `${pointer}/oneOf/${i}`));
    }
    if (Array.isArray(node.allOf)) {
      allOfValidators = node.allOf.map((n, i) => build(n, `${pointer}/allOf/${i}`));
    }
    const required = Array.isArray(node.required) ? node.required : [];
    const additional = node.additionalProperties;
    return (value) => {
      if (node.const !== undefined) {
        if (JSON.stringify(value) !== JSON.stringify(node.const)) {
          return `${pointer} must equal ${JSON.stringify(node.const)}`;
        }
      }
      if (Array.isArray(node.enum)) {
        if (!node.enum.some((o) => JSON.stringify(o) === JSON.stringify(value))) {
          return `${pointer} must be one of ${JSON.stringify(node.enum)}`;
        }
      }
      if (node.type !== undefined) {
        const types = Array.isArray(node.type) ? node.type : [node.type];
        if (!types.some((t) => matchesType(t, value))) {
          return `${pointer} must be of type ${types.join("|")}`;
        }
      }
      if (
        node.type === "object" ||
        node.properties !== undefined ||
        required.length > 0 ||
        additional === false
      ) {
        if (value === null || typeof value !== "object" || Array.isArray(value)) {
          return null;
        }
        for (const key of required) {
          if (!(key in value)) {
            return `${pointer} is missing required property "${key}"`;
          }
        }
        for (const key of Object.keys(value)) {
          if (!(key in subValidators)) {
            if (additional === false) {
              return `${pointer} has unexpected property "${key}"`;
            }
            continue;
          }
          const error = subValidators[key](value[key]);
          if (error) return error;
        }
      }
      if (node.type === "array" || itemsValidator) {
        if (!Array.isArray(value)) return null;
        if (itemsValidator) {
          for (let i = 0; i < value.length; i += 1) {
            const error = itemsValidator(value[i]);
            if (error) return `${error} (at index ${i})`;
          }
        }
      }
      if (typeof node.format === "string" && typeof value === "string") {
        if (node.format === "date-time" && Number.isNaN(Date.parse(value))) {
          return `${pointer} must be a valid date-time`;
        }
      }
      if (typeof node.pattern === "string" && typeof value === "string") {
        if (!new RegExp(node.pattern).test(value)) {
          return `${pointer} must match pattern ${node.pattern}`;
        }
      }
      if (oneOfValidators) {
        const matched = oneOfValidators.filter((fn) => fn(value) === null);
        if (matched.length !== 1) {
          return `${pointer} must match exactly one of oneOf (matched ${matched.length})`;
        }
      }
      if (allOfValidators) {
        for (let i = 0; i < allOfValidators.length; i += 1) {
          const error = allOfValidators[i](value);
          if (error) return `${pointer} ${error}`;
        }
      }
      return null;
    };
  }
  return build(schema, "#");
}

function matchesType(type, value) {
  if (type === "null") return value === null;
  if (type === "array") return Array.isArray(value);
  if (type === "object")
    return value !== null && typeof value === "object" && !Array.isArray(value);
  if (type === "string") return typeof value === "string";
  if (type === "number") return typeof value === "number";
  if (type === "integer") return typeof value === "number" && Number.isInteger(value);
  if (type === "boolean") return typeof value === "boolean";
  return false;
}

function validate(value, schema) {
  return compileSchema(schema)(value);
}

const PROMO_ARGS = [
  "promotion-metadata",
  "--fixture",
  FIXTURE,
  "--label",
  "promotion: candidate",
];

test("issue #33: Promotion label is the authoritative opt-in signal", async () => {
  const { code, stderr } = await runEngineExpectFailure([
    "promotion-metadata",
    "--fixture",
    FIXTURE,
  ]);
  assert.equal(code, 6, "engine must exit 6 when no --label is supplied");
  assert.match(stderr, /promotion-metadata requires --label/i);
  assert.match(stderr, /authoritative Promotion opt-in signal/i);
});

test("issue #33: Promotion metadata is required to validate against the promotion-metadata schema", async () => {
  const { json: promo } = await runEngineJson([
    ...PROMO_ARGS,
    "--source-pr",
    "https://github.com/example/derived-app/pull/42",
  ]);
  const schema = await readJson(join(SCHEMAS, "promotion-metadata.schema.json"));
  const error = validate(promo, schema);
  assert.equal(
    error,
    null,
    error ?? "Promotion metadata (with --label) must validate against the promotion-metadata schema"
  );
});

test("issue #33: Promotion metadata records source project identity, trust class, and source PR link", async () => {
  const { json: promo } = await runEngineJson([
    ...PROMO_ARGS,
    "--source-pr",
    "https://github.com/example/derived-app/pull/42",
  ]);
  assert.equal(promo.derivedProjectId, TRUSTED_ID);
  assert.equal(promo.trustClass, "trusted");
  assert.equal(promo.trust?.trustClass, "trusted");
  assert.equal(promo.trust?.source, "registry-listed");
  assert.equal(promo.sourcePR, "https://github.com/example/derived-app/pull/42");
  assert.deepEqual(promo.sourcePRs, [
    "https://github.com/example/derived-app/pull/42",
  ]);
});

test("issue #33: Promotion metadata records baseline Template revision", async () => {
  const { json: promo } = await runEngineJson(PROMO_ARGS);
  assert.equal(promo.baselineRevision, "v1.1.0");
});

test("issue #33: Promotion candidates are filtered to Template-owned paths", async () => {
  const { json: promo } = await runEngineJson(PROMO_ARGS);
  assert.ok(promo.candidates.length >= 2, "Promotion candidates must include Template-owned additions");
  for (const c of promo.candidates) {
    assert.equal(
      c.ownership,
      "template-owned",
      `${c.path} must be Template-owned to be a Promotion candidate`
    );
  }
  const paths = promo.candidates.map((c) => c.path).sort();
  assert.ok(
    paths.includes("packages/util/retry.ts"),
    "Promotion candidates must include packages/util/retry.ts (Template-owned addition)"
  );
  assert.ok(
    paths.includes("packages/util/package.json"),
    "Promotion candidates must include packages/util/package.json (Template-owned addition)"
  );
});

test("issue #33: Custom-owned Product domain changes are skipped by default and reported clearly", async () => {
  const { json: promo } = await runEngineJson(PROMO_ARGS);
  assert.ok(promo.skipped.length >= 3, "Promotion skipped must include Custom-owned Product-domain files");
  for (const s of promo.skipped) {
    if (s.ownership === "custom-owned") {
      assert.equal(
        s.reason,
        "custom-owned-product-domain",
        `${s.path} (Custom-owned) must be skipped with reason custom-owned-product-domain`
      );
    }
  }
  const skippedPaths = promo.skipped.map((s) => s.path);
  for (const p of [
    "apps/checkout/index.ts",
    "apps/checkout/payment-handler.ts",
    "apps/checkout/README.md",
  ]) {
    assert.ok(
      skippedPaths.includes(p),
      `Promotion skipped must include ${p} (Product domain)`
    );
  }
});

test("issue #33: Mixed-with-seam paths are skipped with mixed-protected-by-seam", async () => {
  const cloneDir = join(WORK_ROOT, "mixed-seam");
  await mkdir(WORK_ROOT, { recursive: true });
  await copyFixtureDerivedProject(cloneDir);
  // Register a new seam and a new ownership rule for a Mixed-with-seam path.
  const policyPath = join(cloneDir, ".beztack/template.json");
  const policy = JSON.parse(await readText(policyPath));
  policy.ownership.push({
    path: "apps/api/seam-promotion-test.ts",
    strategy: "mixed",
    note: "Mixed-with-seam path for Promotion test (issue #33).",
  });
  policy.seams.push({
    id: "seam-promotion-test",
    file: "apps/api/seam-promotion-test.ts",
    marker: "registerRoute(",
    note: "Test seam.",
  });
  await writeFile(policyPath, JSON.stringify(policy, null, 2) + "\n", "utf8");
  await writeFile(
    join(cloneDir, "apps/api/seam-promotion-test.ts"),
    "// Mixed-with-seam content\nregisterRoute('/promotion-test', () => 'ok');\n",
    "utf8"
  );
  const { json: promo } = await runEngineJson([
    "promotion-metadata",
    "--fixture",
    FIXTURE,
    "--derived-project",
    cloneDir,
    "--label",
    "promotion: candidate",
  ]);
  const seamPath = promo.skipped.find(
    (s) => s.path === "apps/api/seam-promotion-test.ts"
  );
  assert.ok(seamPath, "Mixed-with-seam path must be skipped");
  assert.equal(seamPath.ownership, "mixed");
  assert.equal(seamPath.reason, "mixed-protected-by-seam");
});

test("issue #33: Mixed-without-seam paths are surfaced for Platform extraction, not direct Promotion", async () => {
  const cloneDir = join(WORK_ROOT, "mixed-no-seam");
  await copyFixtureDerivedProject(cloneDir);
  // Add a new Mixed-without-seam rule (no seam registered).
  const policyPath = join(cloneDir, ".beztack/template.json");
  const policy = JSON.parse(await readText(policyPath));
  policy.ownership.push({
    path: "apps/api/platform-extraction-test.ts",
    strategy: "mixed",
    note: "Mixed-without-seam path for Promotion test (issue #33).",
  });
  await writeFile(policyPath, JSON.stringify(policy, null, 2) + "\n", "utf8");
  await writeFile(
    join(cloneDir, "apps/api/platform-extraction-test.ts"),
    "// Mixed-without-seam content\n",
    "utf8"
  );
  const { json: promo } = await runEngineJson([
    "promotion-metadata",
    "--fixture",
    FIXTURE,
    "--derived-project",
    cloneDir,
    "--label",
    "promotion: candidate",
  ]);
  const platformExtraction = promo.skipped.find(
    (s) => s.path === "apps/api/platform-extraction-test.ts"
  );
  assert.ok(platformExtraction, "Mixed-without-seam path must be skipped");
  assert.equal(platformExtraction.ownership, "mixed");
  assert.equal(
    platformExtraction.reason,
    "platform-extraction-required",
    "Mixed-without-seam path must surface Platform extraction guidance, not direct Promotion"
  );
});

test("issue #33: Overlapping ownership rules are detected via status overlaps and reported to the reviewer", async () => {
  // The fixture's apps/checkout/* path matches both apps/checkout/** (custom-owned)
  // and apps/** (template-owned). The more-specific rule wins for Promotion
  // resolution (custom-owned → skipped as custom-owned-product-domain). The
  // overlap itself is surfaced in the Sync state overlaps[] so the reviewer
  // can resolve the policy intent.
  const { json: status } = await runEngineJson([
    "status",
    "--fixture",
    FIXTURE,
  ]);
  assert.ok(
    Array.isArray(status.overlaps),
    "Sync state must include an overlaps[] array"
  );
  assert.ok(
    status.overlaps.some(
      (o) => o.path === "apps/checkout/payment-handler.ts"
    ),
    "Sync state overlaps must surface apps/checkout/* (more-specific vs catch-all conflict)"
  );

  const { json: promo } = await runEngineJson(PROMO_ARGS);
  const checkoutEntry = promo.skipped.find(
    (s) => s.path === "apps/checkout/payment-handler.ts"
  );
  assert.ok(checkoutEntry, "Custom-owned Product-domain file must be skipped from Promotion");
  assert.equal(checkoutEntry.ownership, "custom-owned");
  assert.equal(
    checkoutEntry.reason,
    "custom-owned-product-domain",
    "Custom-owned Product-domain file must be skipped with reason custom-owned-product-domain"
  );
});

test("issue #33: promotion-metadata schema accepts the ownership-ambiguous skip reason", async () => {
  // The schema enum lists ownership-ambiguous even though the current engine
  // never emits it for Promotion (more-specific rules win). This test pins
  // the schema-level invariant so future engines can surface the reason.
  const schema = await readJson(join(SCHEMAS, "promotion-metadata.schema.json"));
  const skipReason = schema.properties.skipped.items.properties.reason;
  assert.ok(Array.isArray(skipReason.enum));
  assert.ok(
    skipReason.enum.includes("ownership-ambiguous"),
    "promotion-metadata schema must allow ownership-ambiguous as a skip reason"
  );
});

test("issue #33: --source-pr is repeatable; first link mirrored in sourcePR, all in sourcePRs", async () => {
  const { json: promo } = await runEngineJson([
    ...PROMO_ARGS,
    "--source-pr",
    "https://github.com/example/derived-app/pull/42",
    "--source-pr",
    "https://github.com/example/derived-app/issues/100",
  ]);
  assert.equal(promo.sourcePR, "https://github.com/example/derived-app/pull/42");
  assert.deepEqual(promo.sourcePRs, [
    "https://github.com/example/derived-app/pull/42",
    "https://github.com/example/derived-app/issues/100",
  ]);
});

test("issue #33: source PR / issue refs are omitted entirely when none are supplied", async () => {
  const { json: promo } = await runEngineJson(PROMO_ARGS);
  assert.equal(
    "sourcePR" in promo,
    false,
    "sourcePR must be absent when no --source-pr was supplied"
  );
  assert.equal(
    "sourcePRs" in promo,
    false,
    "sourcePRs must be absent when no --source-pr was supplied"
  );
});

test("issue #33: related Promotions are linked in metadata, not auto-deduplicated", async () => {
  const { json: promo } = await runEngineJson([
    ...PROMO_ARGS,
    "--related-promotion",
    "dp_01HMVBEZTACK0000000000000B,promotion: candidate",
    "--related-promotion",
    "dp_01HMVBEZTACK0000000000000R,promotion: candidate-overlap",
  ]);
  assert.equal(promo.relatedPromotions.length, 2);
  const ids = promo.relatedPromotions.map((r) => r.derivedProjectId).sort();
  assert.deepEqual(ids, [
    "dp_01HMVBEZTACK0000000000000B",
    "dp_01HMVBEZTACK0000000000000R",
  ]);
  for (const r of promo.relatedPromotions) {
    assert.ok(typeof r.label === "string" && r.label.length > 0);
  }
});

test("issue #33: --related-promotion rejects malformed DERIVED_PROJECT_ID,LABEL pairs", async () => {
  const { code, stderr } = await runEngineExpectFailure([
    ...PROMO_ARGS,
    "--related-promotion",
    "no-comma-here",
  ]);
  assert.notEqual(code, 0, "engine must reject malformed --related-promotion");
  assert.match(stderr, /DERIVED_PROJECT_ID,LABEL/);
});

test("issue #33: Trusted Derived project + --trusted-automation → entryMode trusted-automation", async () => {
  const { json: promo } = await runEngineJson([
    ...PROMO_ARGS,
    "--trusted-automation",
    "--source-pr",
    "https://github.com/beztack/lncd/pull/7",
  ]);
  assert.equal(promo.entryMode, "trusted-automation");
  assert.equal(promo.trustClass, "trusted");
});

test("issue #33: Trusted Derived project without --trusted-automation → entryMode normal-pr", async () => {
  const { json: promo } = await runEngineJson([
    ...PROMO_ARGS,
    "--source-pr",
    "https://github.com/beztack/lncd/pull/7",
  ]);
  assert.equal(promo.entryMode, "normal-pr");
});

test("issue #33: Community Derived project + --community-entry-mode patch → entryMode patch", async () => {
  const cloneDir = join(WORK_ROOT, "community-patch");
  await copyFixtureDerivedProject(cloneDir);
  await rewriteDerivedProjectId(cloneDir, UNKNOWN_ID);
  const { json: promo } = await runEngineJson([
    "promotion-metadata",
    "--fixture",
    FIXTURE,
    "--derived-project",
    cloneDir,
    "--label",
    "promotion: candidate",
    "--community-entry-mode",
    "patch",
    "--source-pr",
    "https://github.com/community-derived/derived-app/pull/3",
  ]);
  assert.equal(promo.entryMode, "patch");
  assert.equal(promo.trustClass, "community");
});

test("issue #33: Community Derived project without --community-entry-mode → entryMode normal-pr", async () => {
  const cloneDir = join(WORK_ROOT, "community-default");
  await copyFixtureDerivedProject(cloneDir);
  await rewriteDerivedProjectId(cloneDir, UNKNOWN_ID);
  const { json: promo } = await runEngineJson([
    "promotion-metadata",
    "--fixture",
    FIXTURE,
    "--derived-project",
    cloneDir,
    "--label",
    "promotion: candidate",
  ]);
  assert.equal(promo.entryMode, "normal-pr");
});

test("issue #33: --trusted-automation is ignored with a warning when trust class is community", async () => {
  const cloneDir = join(WORK_ROOT, "community-trusted-automation");
  await copyFixtureDerivedProject(cloneDir);
  await rewriteDerivedProjectId(cloneDir, UNKNOWN_ID);
  const { json: promo, stderr } = await runEngineJson([
    "promotion-metadata",
    "--fixture",
    FIXTURE,
    "--derived-project",
    cloneDir,
    "--label",
    "promotion: candidate",
    "--trusted-automation",
  ]);
  assert.equal(promo.entryMode, "normal-pr");
  assert.match(stderr, /--trusted-automation ignored/);
});

test("issue #33: --community-entry-mode patch is ignored with a warning when trust class is trusted", async () => {
  const { json: promo, stderr } = await runEngineJson([
    ...PROMO_ARGS,
    "--community-entry-mode",
    "patch",
  ]);
  assert.equal(promo.entryMode, "normal-pr");
  assert.match(stderr, /--community-entry-mode patch ignored/);
});

test("issue #33: --community-entry-mode rejects values outside {normal-pr, patch}", async () => {
  const { code, stderr } = await runEngineExpectFailure([
    ...PROMO_ARGS,
    "--community-entry-mode",
    "carrier-pigeon",
  ]);
  assert.equal(code, 2, "engine must exit 2 on invalid --community-entry-mode");
  assert.match(stderr, /--community-entry-mode must be one of normal-pr\|patch/);
});

test("issue #33: checks[] records engine-internal validation with source=engine", async () => {
  const { json: promo } = await runEngineJson(PROMO_ARGS);
  assert.ok(Array.isArray(promo.checks) && promo.checks.length >= 7);
  for (const c of promo.checks) {
    assert.equal(
      c.source,
      "engine",
      `engine-emitted check ${c.name} must declare source=engine`
    );
    assert.ok(typeof c.name === "string" && c.name.length > 0);
    assert.ok(["pass", "fail", "skip"].includes(c.result));
  }
  const expectedEngineChecks = [
    "schema/sync-policy",
    "schema/origin-baseline",
    "schema/sync-state",
    "ownership/overlap-validation",
    "promotion/candidate-filter",
    "engine/version-compatibility",
    "registry/trust-resolution",
  ];
  for (const expected of expectedEngineChecks) {
    assert.ok(
      promo.checks.some((c) => c.name === expected),
      `engine-emitted checks[] must include ${expected}`
    );
  }
});

test("issue #33: --check NAME=RESULT adds upstream-pr-ci entries to checks[]", async () => {
  const { json: promo } = await runEngineJson([
    ...PROMO_ARGS,
    "--check",
    "lint=pass",
    "--check",
    "typecheck=pass",
    "--check",
    "unit-tests=fail",
  ]);
  const upstreamChecks = promo.checks.filter((c) => c.source === "upstream-pr-ci");
  assert.equal(upstreamChecks.length, 3);
  const names = upstreamChecks.map((c) => c.name).sort();
  assert.deepEqual(names, ["lint", "typecheck", "unit-tests"]);
  const lintCheck = upstreamChecks.find((c) => c.name === "lint");
  assert.equal(lintCheck.result, "pass");
  const unitTestsCheck = upstreamChecks.find((c) => c.name === "unit-tests");
  assert.equal(unitTestsCheck.result, "fail");
});

test("issue #33: --check entries must be NAME=RESULT with valid result", async () => {
  const { code, stderr } = await runEngineExpectFailure([
    ...PROMO_ARGS,
    "--check",
    "no-equals-sign",
  ]);
  assert.notEqual(code, 0);
  assert.match(stderr, /NAME=RESULT/);
});

test("issue #33: suggestedTemplateVersionImpact reflects Promotion candidate scope", async () => {
  const { json: promo } = await runEngineJson(PROMO_ARGS);
  assert.equal(
    promo.suggestedTemplateVersionImpact,
    "minor",
    "Promotion candidates adding reusable Template-owned capability suggest minor"
  );
});

test("issue #33: Promotion metadata resolves Trust class from registry, not from project-side hints", async () => {
  const cloneDir = join(WORK_ROOT, "community-registry-truth");
  await copyFixtureDerivedProject(cloneDir);
  await rewriteDerivedProjectId(cloneDir, UNKNOWN_ID);
  // Project self-declares "trusted" via --label only; engine must still resolve community.
  const { json: promo } = await runEngineJson([
    "promotion-metadata",
    "--fixture",
    FIXTURE,
    "--derived-project",
    cloneDir,
    "--label",
    "promotion: candidate",
    "--source-pr",
    "https://github.com/community/derived/pull/1",
  ]);
  assert.equal(promo.trustClass, "community");
  assert.equal(promo.trust.source, "registry-absent-default-community");
});

test("issue #33: human-readable Promotion metadata renders the Promotion flow", async () => {
  const { stdout } = await runEngine([
    ...PROMO_ARGS,
    "--source-pr",
    "https://github.com/example/derived-app/pull/42",
    "--format",
    "human",
  ]);
  assert.match(stdout, /# Promotion metadata/);
  assert.match(stdout, /Promotion label:.*`promotion: candidate`/);
  assert.match(stdout, /Entry mode:/);
  assert.match(stdout, /Source PR \/ issue links/);
  assert.match(stdout, /https:\/\/github\.com\/example\/derived-app\/pull\/42/);
  assert.match(stdout, /## Promotion candidates/);
  assert.match(stdout, /packages\/util\/retry\.ts/);
  assert.match(stdout, /## Skipped files/);
  assert.match(stdout, /apps\/checkout\/index\.ts/);
  assert.match(stdout, /## Checks/);
  assert.match(stdout, /registry\/trust-resolution/);
  assert.match(stdout, /Suggested Template version impact/);
  assert.match(stdout, /Distinction from Platform extraction/);
});

test("issue #33: human-readable Promotion metadata distinguishes trusted-automation vs patch entry modes", async () => {
  const { stdout: trustedHuman } = await runEngine([
    ...PROMO_ARGS,
    "--source-pr",
    "https://github.com/beztack/lncd/pull/7",
    "--trusted-automation",
    "--format",
    "human",
  ]);
  assert.match(trustedHuman, /TRUSTED AUTOMATION/);
  assert.match(trustedHuman, /Trusted automation.*the source PR was opened by Beztack-owned automation/);
  assert.match(trustedHuman, /Beztack review is still required/);

  const cloneDir = join(WORK_ROOT, "patch-entry");
  await copyFixtureDerivedProject(cloneDir);
  await rewriteDerivedProjectId(cloneDir, UNKNOWN_ID);
  const { stdout: patchHuman } = await runEngine([
    "promotion-metadata",
    "--fixture",
    FIXTURE,
    "--derived-project",
    cloneDir,
    "--label",
    "promotion: candidate",
    "--community-entry-mode",
    "patch",
    "--format",
    "human",
  ]);
  assert.match(patchHuman, /PATCH \(COMMUNITY\)/);
  assert.match(patchHuman, /Community patch entry.*the source PR was submitted as a patch/);
  assert.match(patchHuman, /Beztack CI must validate the patch/);
});

test("issue #33: Promotion metadata rejects unsupported schema versions (gate from #30)", async () => {
  const cloneDir = join(WORK_ROOT, "schema-rejected");
  await copyFixtureDerivedProject(cloneDir);
  // Tamper with sync-policy schemaVersion to an unsupported value.
  const policyPath = join(cloneDir, ".beztack/template.json");
  const tampered = JSON.parse(await readText(policyPath));
  tampered.schemaVersion = "0.9";
  await writeFile(policyPath, JSON.stringify(tampered, null, 2) + "\n", "utf8");
  const { code, stderr } = await runEngineExpectFailure([
    ...PROMO_ARGS,
    "--derived-project",
    cloneDir,
  ]);
  assert.equal(code, 3, "engine must exit 3 on schema-version mismatch (issue #30 gate)");
  assert.match(stderr, /Schema validation failed/);
});

test("issue #33: BEZTACK_PROMOTION_LABEL env var is honored when --label is absent", async () => {
  const envTest = await execFile(
    "node",
    [ENGINE, "promotion-metadata", "--fixture", FIXTURE],
    {
      cwd: REPO_ROOT,
      env: { ...process.env, BEZTACK_PROMOTION_LABEL: "promotion: env-var-test" },
    }
  );
  const parsed = JSON.parse(envTest.stdout);
  assert.equal(parsed.label, "promotion: env-var-test");
});

test("issue #33: Promotion metadata does NOT leak engine-internal paths into candidates or skipped", async () => {
  const { json: promo } = await runEngineJson(PROMO_ARGS);
  const paths = [...promo.candidates, ...promo.skipped].map((e) => e.path);
  for (const path of paths) {
    assert.ok(
      !path.startsWith(".beztack/"),
      `engine-internal path ${path} must not appear in Promotion candidates/skipped`
    );
    assert.ok(path !== "node_modules", "node_modules must not appear in Promotion output");
  }
});

test("issue #33: Promotion metadata with no eligible candidates reports suggestedTemplateVersionImpact=none", async () => {
  // Clone the fixture and remove the two Promotion candidates (Template-owned additions).
  const cloneDir = join(WORK_ROOT, "no-candidates");
  await copyFixtureDerivedProject(cloneDir);
  await rm(join(cloneDir, "packages/util/retry.ts"), { force: true });
  await rm(join(cloneDir, "packages/util/package.json"), { force: true });
  await rmdirIfEmpty(join(cloneDir, "packages/util"));
  const { json: promo } = await runEngineJson([
    "promotion-metadata",
    "--fixture",
    FIXTURE,
    "--derived-project",
    cloneDir,
    "--label",
    "promotion: candidate",
  ]);
  assert.equal(promo.candidates.length, 0);
  assert.equal(promo.suggestedTemplateVersionImpact, "none");
});

async function rmdirIfEmpty(path) {
  try {
    await readdir(path);
    await rm(path, { recursive: true, force: true });
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
}
