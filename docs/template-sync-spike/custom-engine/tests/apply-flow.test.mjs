/**
 * Tests for the PR-only status / apply flow (issue #31).
 *
 * Validates the engine prototype against the contract from issue #31:
 *   - `status` JSON includes current and target revisions, resolved
 *     ownership, drift, conflicts, and a recommended next action.
 *   - `status --format human` produces a human-readable Markdown view.
 *   - `apply --plan` JSON names a branch and never mutates main.
 *   - `apply --worktree PATH` prepares a PR-ready branch: the worktree
 *     contains the planned file updates, the seam is preserved,
 *     Custom-owned files are untouched, conflicts are reported, the
 *     Origin baseline / Sync state / Sync event log are updated in the
 *     worktree (not in the source derived project), and a BRANCH_README
 *     documents the work and lockfile-regeneration expectations.
 *
 * Runs with Node's built-in test runner (no external dependencies):
 *   node --test docs/template-sync-spike/custom-engine/tests/apply-flow.test.mjs
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile as execFileCb } from "node:child_process";
import { mkdir, readFile, rm, writeFile, copyFile, readdir, stat } from "node:fs/promises";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { createHash } from "node:crypto";

const execFile = promisify(execFileCb);
const here = dirname(fileURLToPath(import.meta.url));
const ENGINE_DIR = resolve(here, "..");
const REPO_ROOT = resolve(ENGINE_DIR, "../../..");
const FIXTURE = join(REPO_ROOT, "docs/template-sync-fixture");
const ENGINE = join(ENGINE_DIR, "beztack-sync.mjs");
const SCHEMAS = join(FIXTURE, "schemas");

const WORK_ROOT = "/tmp/opencode/beztack-apply-test";

function sha256(text) {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function readText(path) {
  return readFile(path, "utf8");
}

async function runEngine(args) {
  const { stdout, stderr } = await execFile("node", [ENGINE, ...args], {
    cwd: REPO_ROOT,
  });
  return { stdout, stderr };
}

async function runEngineJson(args) {
  const { stdout, stderr } = await runEngine(args);
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch (err) {
    throw new Error(
      `engine output was not valid JSON (args=${JSON.stringify(args)}):\n${stdout}\n${stderr}`
    );
  }
  return { json: parsed, stderr };
}

async function listFiles(root) {
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
      if (entry.name === ".git") continue;
      const abs = join(dir, entry.name);
      const rel = abs.slice(root.length + 1);
      if (entry.isDirectory()) {
        await walk(abs);
      } else if (entry.isFile()) {
        result[rel] = abs;
      }
    }
  }
  await walk(root);
  return result;
}

/**
 * Minimal JSON Schema validator covering the subset used by the spike
 * schemas (type, const, enum, required, additionalProperties, properties,
 * items, $ref, $defs, oneOf, allOf, pattern, and date-time format).
 */
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
  if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  if (type === "string") return typeof value === "string";
  if (type === "number") return typeof value === "number";
  if (type === "integer") return typeof value === "number" && Number.isInteger(value);
  if (type === "boolean") return typeof value === "boolean";
  return false;
}

function validate(value, schema) {
  return compileSchema(schema)(value);
}

test("status JSON contains every field the contract requires", async () => {
  const { json: status } = await runEngineJson([
    "status",
    "--fixture",
    FIXTURE,
    "--engine",
    "beztack-sync-prototype",
    "0.2.0",
  ]);
  for (const key of [
    "schemaVersion",
    "derivedProjectId",
    "templateId",
    "currentRevision",
    "candidateRevision",
    "syncEngine",
    "status",
    "files",
    "conflicts",
    "overlaps",
    "recommendation",
  ]) {
    assert.ok(key in status, `status JSON must include "${key}"`);
  }
  assert.equal(status.currentRevision, "v1.1.0");
  assert.equal(status.candidateRevision, "v1.2.0");
  assert.ok(typeof status.recommendation.action === "string", "recommendation.action must be a string");
  assert.ok(
    Object.keys(status.files).length > 0,
    "status files map must be non-empty"
  );
  assert.ok(
    status.conflicts.some((c) => c.path === "apps/api/middleware.ts"),
    "fixture's known conflict must be reported in status.conflicts"
  );
  assert.ok(
    status.overlaps.some((o) => o.path === "packages/auth/session.ts"),
    "fixture's known overlap must be reported in status.overlaps"
  );
});

test("status JSON validates against the sync-state schema", async () => {
  const schema = await readJson(join(SCHEMAS, "sync-state.schema.json"));
  const { json: status } = await runEngineJson([
    "status",
    "--fixture",
    FIXTURE,
  ]);
  const error = validate(status, schema);
  assert.equal(error, null, error ?? "status JSON must validate against sync-state schema");
});

test("status --format human emits a readable Markdown report", async () => {
  const { stdout } = await runEngine([
    "status",
    "--fixture",
    FIXTURE,
    "--format",
    "human",
  ]);
  assert.match(stdout, /# Sync status:/, "human view must have a status header");
  assert.match(stdout, /\*\*Current revision:\*\* `v1\.1\.0`/, "human view must show current revision");
  assert.match(stdout, /\*\*Target revision:\*\* `v1\.2\.0`/, "human view must show target revision");
  assert.match(stdout, /## Recommended next action/, "human view must have a recommended action section");
  assert.match(stdout, /## Files/, "human view must have a Files section");
  assert.match(stdout, /## Sync conflicts/, "human view must have a conflicts section");
  assert.match(stdout, /apps\/api\/middleware\.ts/, "human view must mention the known conflict path");
  assert.ok(
    !/^---$/.test(stdout.trim().split("\n")[0]),
    "human view must not start with YAML frontmatter"
  );
});

test("apply --plan JSON names a non-main branch and reports the planned changes", async () => {
  const { json: envelope } = await runEngineJson([
    "apply",
    "--plan",
    "--fixture",
    FIXTURE,
  ]);
  const plan = envelope.plan ?? envelope;
  assert.notEqual(plan.branch, "main", "apply branch must not be main");
  assert.notEqual(plan.branch, "master", "apply branch must not be master");
  assert.match(plan.branch, /^template-sync\//, "branch name must follow the template-sync/ convention");
  assert.ok(plan.summary && plan.summary.length > 0, "plan must include a human-readable summary");
  assert.ok(plan.updates.length > 0, "plan must include at least one update");
  assert.ok(
    plan.conflicts.some((c) => c.path === "apps/api/middleware.ts"),
    "plan must report the known conflict"
  );
  assert.ok(plan.skipped.length > 0, "plan must include skipped files");
  assert.ok(
    plan.skipped.some((s) => s.path === "pnpm-lock.yaml"),
    "plan must skip the lockfile (engines regenerate it locally)"
  );
  assert.ok(
    plan.updates.some((u) => u.path === "apps/api/routes.ts" && u.seam === "api-route-registration"),
    "plan must update apps/api/routes.ts with the api-route-registration seam preserved"
  );
});

test("apply --plan JSON validates against the apply-plan schema", async () => {
  const schema = await readJson(join(SCHEMAS, "apply-plan.schema.json"));
  const { json: envelope } = await runEngineJson([
    "apply",
    "--plan",
    "--fixture",
    FIXTURE,
  ]);
  const plan = envelope.plan ?? envelope;
  const error = validate(plan, schema);
  assert.equal(error, null, error ?? "plan JSON must validate against apply-plan schema");
});

test("apply --worktree prepares a PR-ready branch without mutating the source derived project", async () => {
  const worktree = join(WORK_ROOT, "branch");
  await rm(worktree, { recursive: true, force: true });
  await mkdir(WORK_ROOT, { recursive: true });

  const before = await readText(
    join(FIXTURE, "derived-project/apps/api/routes.ts")
  );
  const beforeLockfile = await readText(
    join(FIXTURE, "derived-project/pnpm-lock.yaml")
  );
  const beforeCheckout = await readText(
    join(FIXTURE, "derived-project/apps/checkout/index.ts")
  );

  const { json: envelope } = await runEngineJson([
    "apply",
    "--worktree",
    worktree,
    "--fixture",
    FIXTURE,
  ]);
  const plan = envelope.plan;
  const result = envelope.result;

  assert.ok(result, "engine must return a result object for the worktree prepare");
  assert.equal(result.worktree, worktree);
  assert.equal(result.branch, "template-sync/v1.1.0-to-v1.2.0");
  assert.equal(result.branchCreated, false, "default --worktree does not init a git branch");
  assert.ok(typeof result.eventId === "string" && result.eventId.length > 0, "engine must record an eventId");
  assert.ok(
    result.updatesApplied >= 3,
    "engine must apply at least the three planned Template-owned updates (env contract, package.json, seam-preserved harness)"
  );

  const after = await readText(
    join(FIXTURE, "derived-project/apps/api/routes.ts")
  );
  const afterLockfile = await readText(
    join(FIXTURE, "derived-project/pnpm-lock.yaml")
  );
  const afterCheckout = await readText(
    join(FIXTURE, "derived-project/apps/checkout/index.ts")
  );
  assert.equal(before, after, "source derived-project/apps/api/routes.ts must not be mutated");
  assert.equal(beforeLockfile, afterLockfile, "source derived-project/pnpm-lock.yaml must not be mutated");
  assert.equal(beforeCheckout, afterCheckout, "source derived-project/apps/checkout/index.ts must not be mutated");

  const worktreeFiles = await listFiles(worktree);
  assert.ok("BRANCH_README.md" in worktreeFiles, "worktree must include BRANCH_README.md");
  assert.ok("apps/api/routes.ts" in worktreeFiles, "worktree must include the updated seam file");
  assert.ok("apps/api/middleware.ts" in worktreeFiles, "worktree must keep the conflict file (unmodified)");
  assert.ok("apps/checkout/index.ts" in worktreeFiles, "worktree must keep Custom-owned files");
  assert.ok("pnpm-lock.yaml" in worktreeFiles, "worktree must keep the Custom-owned lockfile");
  assert.ok(".beztack/origin.json" in worktreeFiles, "worktree must include the updated origin.json");
  assert.ok(".beztack/sync-state.json" in worktreeFiles, "worktree must include the updated sync-state.json");
  assert.ok(".beztack/sync-event-log.json" in worktreeFiles, "worktree must include the updated sync-event-log.json");
});

test("apply --worktree preserves the Sync seam contents in apps/api/routes.ts", async () => {
  const worktree = join(WORK_ROOT, "seam");
  await rm(worktree, { recursive: true, force: true });
  await mkdir(WORK_ROOT, { recursive: true });

  const { json: envelope } = await runEngineJson([
    "apply",
    "--worktree",
    worktree,
    "--fixture",
    FIXTURE,
  ]);
  const updated = await readText(join(worktree, "apps/api/routes.ts"));
  const harness = await readText(
    join(FIXTURE, "template-revisions/v1.2.0/apps/api/routes.ts")
  );
  const derived = await readText(
    join(FIXTURE, "derived-project/apps/api/routes.ts")
  );

  assert.match(updated, /__templateVersion = "1\.2\.0"/, "worktree must use the v1.2.0 harness");
  assert.match(updated, /routeCount/, "worktree must include the v1.2.0-only routeCount() function");
  assert.match(updated, /registerRoute\("\/health"/, "worktree must preserve the Derived project's /health route");
  assert.match(updated, /registerRoute\("\/api\/products\/:id"/, "worktree must preserve the Derived project's /api/products/:id route");
  assert.ok(updated.length > harness.length, "worktree file must be longer than the v1.2.0 candidate (seam content added)");
  assert.ok(updated.length > derived.length, "worktree file must be longer than the original Derived project file (candidate harness applied)");

  const envelopeResult = envelope.result;
  assert.ok(
    Array.isArray(envelopeResult.seamsPreserved) &&
      envelopeResult.seamsPreserved.length > 0 &&
      envelopeResult.seamsPreserved[0].includes("api-route-registration"),
    "engine must report that the api-route-registration seam was preserved"
  );
});

test("apply --worktree preserves Custom-owned Product-domain files verbatim", async () => {
  const worktree = join(WORK_ROOT, "preserved");
  await rm(worktree, { recursive: true, force: true });
  await mkdir(WORK_ROOT, { recursive: true });

  await runEngineJson(["apply", "--worktree", worktree, "--fixture", FIXTURE]);

  for (const path of [
    "apps/checkout/index.ts",
    "apps/checkout/payment-handler.ts",
    "apps/checkout/README.md",
    ".env.example",
    "pnpm-lock.yaml",
    "packages/auth/session.ts",
  ]) {
    const before = await readText(join(FIXTURE, "derived-project", path));
    const after = await readText(join(worktree, path));
    assert.equal(after, before, `${path} must be byte-identical in the worktree (Custom-owned preservation)`);
  }
});

test("apply --worktree preserves the conflict file (apps/api/middleware.ts) unchanged", async () => {
  const worktree = join(WORK_ROOT, "conflict");
  await rm(worktree, { recursive: true, force: true });
  await mkdir(WORK_ROOT, { recursive: true });

  await runEngineJson(["apply", "--worktree", worktree, "--fixture", FIXTURE]);

  const before = await readText(
    join(FIXTURE, "derived-project/apps/api/middleware.ts")
  );
  const after = await readText(join(worktree, "apps/api/middleware.ts"));
  assert.equal(after, before, "conflict file must NOT be overwritten in the worktree");

  const readme = await readText(join(worktree, "BRANCH_README.md"));
  assert.match(readme, /apps\/api\/middleware\.ts/, "BRANCH_README must mention the conflict path");
  assert.match(readme, /both-changed-no-seam/, "BRANCH_README must explain the conflict reason");
});

test("apply --worktree renders Template parameters and merges package.json", async () => {
  const worktree = join(WORK_ROOT, "params");
  await rm(worktree, { recursive: true, force: true });
  await mkdir(WORK_ROOT, { recursive: true });

  await runEngineJson(["apply", "--worktree", worktree, "--fixture", FIXTURE]);

  const updatedPkg = JSON.parse(
    await readText(join(worktree, "package.json"))
  );
  assert.equal(updatedPkg.name, "derived-app", "{{appName}} must be rendered from parameters");
  assert.equal(updatedPkg.version, "0.2.0", "package.json version must come from the candidate (Template-owned)");
  assert.ok(
    updatedPkg.dependencies["@beztack/webhooks"],
    "candidate-only dependency @beztack/webhooks must be present"
  );
  assert.ok(
    updatedPkg.dependencies["@derived-app/util"],
    "derived-project-only dependency @derived-app/util must be preserved"
  );
  assert.ok(
    !/\{\{appName\}\}/.test(await readText(join(worktree, "package.json"))),
    "no placeholders may remain in the merged package.json"
  );
});

test("apply --worktree writes schema-versioned Origin baseline, Sync state, and Sync event log", async () => {
  const worktree = join(WORK_ROOT, "schemas");
  await rm(worktree, { recursive: true, force: true });
  await mkdir(WORK_ROOT, { recursive: true });

  await runEngineJson(["apply", "--worktree", worktree, "--fixture", FIXTURE]);

  const origin = await readJson(join(worktree, ".beztack/origin.json"));
  const state = await readJson(join(worktree, ".beztack/sync-state.json"));
  const log = await readJson(join(worktree, ".beztack/sync-event-log.json"));

  const originSchema = await readJson(join(SCHEMAS, "origin-baseline.schema.json"));
  const stateSchema = await readJson(join(SCHEMAS, "sync-state.schema.json"));
  const logSchema = await readJson(join(SCHEMAS, "sync-event-log.schema.json"));

  for (const [name, value, schema] of [
    ["origin", origin, originSchema],
    ["sync-state", state, stateSchema],
    ["sync-event-log", log, logSchema],
  ]) {
    const error = validate(value, schema);
    assert.equal(error, null, error ?? `${name} in worktree must validate against its schema`);
  }

  assert.equal(origin.schemaVersion, "1.0", "Origin baseline must be schemaVersion 1.0");
  assert.equal(origin.templateRevision, "v1.2.0", "Origin baseline must reflect the candidate revision");
  assert.equal(state.currentRevision, "v1.2.0", "Sync state currentRevision must reflect the candidate revision");
  assert.equal(state.candidateRevision, undefined, "Sync state candidateRevision must be cleared after apply");
  assert.ok(
    !("template.json" in origin.files),
    "Origin baseline must not track the Template manifest as a file"
  );
  assert.ok(
    log.events.length >= 5,
    "Sync event log must include the historical events plus the new apply event"
  );
  const lastEvent = log.events[log.events.length - 1];
  assert.equal(lastEvent.type, "apply", "last appended event must be an apply event");
  assert.equal(lastEvent.details.fromRevision, "v1.1.0");
  assert.equal(lastEvent.details.toRevision, "v1.2.0");
  assert.equal(lastEvent.details.branch, "template-sync/v1.1.0-to-v1.2.0");
  assert.equal(lastEvent.syncEngine.name, "beztack-sync-prototype");
  assert.equal(lastEvent.syncEngine.version, "0.2.0");
});

test("apply --worktree BRANCH_README documents the branch, conflicts, and lockfile regeneration", async () => {
  const worktree = join(WORK_ROOT, "readme");
  await rm(worktree, { recursive: true, force: true });
  await mkdir(WORK_ROOT, { recursive: true });

  await runEngineJson(["apply", "--worktree", worktree, "--fixture", FIXTURE]);
  const readme = await readText(join(worktree, "BRANCH_README.md"));

  assert.match(readme, /\*\*Branch name:\*\* `template-sync\/v1\.1\.0-to-v1\.2\.0`/, "BRANCH_README must name the branch");
  assert.match(readme, /\*\*Sync engine:\*\* `beztack-sync-prototype@0\.2\.0`/, "BRANCH_README must record the engine version");
  assert.match(readme, /## Files updated/, "BRANCH_README must list updated files");
  assert.match(readme, /## Files preserved/, "BRANCH_README must list preserved files");
  assert.match(readme, /## Sync conflicts requiring a decision/, "BRANCH_README must list conflicts");
  assert.match(readme, /## Derived artifacts \(regenerate locally\)/, "BRANCH_README must explain lockfile regeneration");
  assert.match(readme, /pnpm install --lockfile-only/, "BRANCH_README must provide the lockfile-regeneration command");
  assert.match(readme, /Do NOT copy a lockfile from the Template source/, "BRANCH_README must warn against copying a lockfile");
  assert.match(readme, /git reset --hard/, "BRANCH_README must document branch-based rollback");
  assert.match(readme, /full-workspace snapshot/, "BRANCH_README must explicitly rule out full-workspace snapshots");
});

test("apply --worktree refuses to overwrite an existing worktree", async () => {
  const worktree = join(WORK_ROOT, "exists");
  await rm(worktree, { recursive: true, force: true });
  await mkdir(WORK_ROOT, { recursive: true });
  await mkdir(worktree, { recursive: true });
  await writeFile(join(worktree, "sentinel.txt"), "do-not-overwrite", "utf8");

  const { code, stderr } = await execFile("node", [
    ENGINE,
    "apply",
    "--worktree",
    worktree,
    "--fixture",
    FIXTURE,
  ], { cwd: REPO_ROOT }).then(
    (r) => ({ code: 0, stderr: r.stderr }),
    (e) => ({ code: typeof e.code === "number" ? e.code : 1, stderr: e.stderr ?? e.message })
  );
  assert.notEqual(code, 0, "engine must exit non-zero when worktree already exists");
  assert.match(stderr, /worktree path already exists/, "engine must explain why it refused");

  const sentinel = await readText(join(worktree, "sentinel.txt"));
  assert.equal(sentinel, "do-not-overwrite", "engine must not touch an existing worktree");
});

test("status --format human includes ownership, drift, conflicts, and recommended next action", async () => {
  const { stdout } = await runEngine([
    "status",
    "--fixture",
    FIXTURE,
    "--format",
    "human",
  ]);
  for (const required of [
    "Current revision:",
    "Target revision:",
    "Recommended next action",
    "Ownership",
    "Drift",
    "Sync conflicts",
    "Ownership overlaps",
  ]) {
    assert.ok(
      stdout.toLowerCase().includes(required.toLowerCase()),
      `human status must mention "${required}"`
    );
  }
  assert.match(stdout, /apps\/api\/middleware\.ts.*both-changed-no-seam/);
  assert.match(stdout, /packages\/auth\/session\.ts/, "human status must include the known overlap path");
});

test("engine refuses to apply when the engine version is below the Template minimum", async () => {
  await mkdir(WORK_ROOT, { recursive: true });
  const worktree = join(WORK_ROOT, "incompat");
  await rm(worktree, { recursive: true, force: true });

  const { code, stderr } = await execFile("node", [
    ENGINE,
    "apply",
    "--worktree",
    worktree,
    "--fixture",
    FIXTURE,
    "--engine",
    "beztack-sync-prototype",
    "0.0.1",
  ], { cwd: REPO_ROOT }).then(
    (r) => ({ code: 0, stderr: r.stderr }),
    (e) => ({ code: typeof e.code === "number" ? e.code : 1, stderr: e.stderr ?? e.message })
  );
  assert.equal(code, 4, "engine must exit 4 on engine-version incompatibility");
  assert.match(stderr, /Engine compatibility check failed/);
  assert.match(stderr, /engine 0\.0\.1 is below Template minimum 0\.2\.0/);
});
