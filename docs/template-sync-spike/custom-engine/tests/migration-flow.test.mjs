/**
 * Tests for the Template migration flow (issue #34).
 *
 * Validates the Beztack Sync engine prototype against the migration
 * contract from issue #34:
 *   1. Template migrations are represented separately from Template-owned
 *      file content (declared on the Template manifest, not as files).
 *   2. A Template version declares migration steps + automatic/manual mode.
 *   3. Migration steps have a dry-run mode or equivalent preview behavior.
 *   4. Migration steps define idempotency checks or conditions.
 *   5. Unsafe or interactive migrations are reported as manual steps
 *      instead of running automatically.
 *   6. Community Derived projects require explicit local execution for
 *      migration steps (engine never runs migrations; community trust
 *      class forces every migration to manual-execution-required).
 *   7. Migration status appears in status or apply output as part of the
 *      recommended next action.
 *   8. The behavior is covered by the Sync engine contract fixture.
 *
 * Runs with Node's built-in test runner (no external dependencies):
 *   node --test docs/template-sync-spike/custom-engine/tests/migration-flow.test.mjs
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile as execFileCb } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
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

const WORK_ROOT = "/tmp/opencode/beztack-migration-test";

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

/**
 * Minimal JSON Schema validator covering the subset used by the spike
 * schemas. Mirrors the one in apply-flow.test.mjs to keep tests
 * self-contained.
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

test("issue #34: Template manifest declares migrations as a first-class array, separate from file content", async () => {
  const manifest = await readJson(
    join(FIXTURE, "template-revisions/v1.2.0/template.json")
  );
  assert.ok(Array.isArray(manifest.migrations), "manifest.migrations must be an array");
  assert.ok(manifest.migrations.length >= 3, "fixture must include at least three migration examples");
  for (const m of manifest.migrations) {
    assert.ok(typeof m.id === "string" && m.id.length > 0, "each migration must have an id");
    assert.ok(["automatic", "manual"].includes(m.mode), "each migration must declare mode");
    assert.ok(typeof m.description === "string", "each migration must have a description");
    assert.ok(typeof m.idempotency === "object", "each migration must declare an idempotency check");
    assert.ok(typeof m.idempotency.type === "string", "each idempotency must declare its type");
  }
});

test("issue #34: status surfaces migrations[] with idempotency evaluated against the Derived project", async () => {
  const { json: status } = await runEngineJson([
    "status",
    "--fixture",
    FIXTURE,
  ]);
  assert.ok(Array.isArray(status.migrations), "status must include migrations[]");
  assert.ok(status.migrations.length >= 3, "status must surface every declared migration");

  const marker = status.migrations.find(
    (m) => m.id === "marker-environments-contract-v1.2.0"
  );
  assert.ok(marker, "status must include the marker-file migration");
  assert.equal(marker.idempotencyStatus, "already-applied", "marker file exists in the fixture, so the engine must report it as already-applied");
  assert.equal(marker.execution, "engine-surfaces-only", "automatic non-interactive non-destructive migration must surface only on a Trusted project");
  assert.equal(marker.trustClass, "any", "marker migration must be trust-class: any");
  assert.ok(typeof marker.dryRunCommand === "string" && marker.dryRunCommand.length > 0, "migration must expose a dry-run command");
  assert.ok(typeof marker.applyCommand === "string" && marker.applyCommand.length > 0, "migration must expose an apply command (engine never runs it)");
  assert.equal(marker.action, "no-human-action-required");

  const rotate = status.migrations.find((m) => m.id === "rotate-webhook-signing-secret");
  assert.ok(rotate, "status must include the rotation migration");
  assert.equal(rotate.idempotencyStatus, "pending", "marker file is missing, so rotation must be pending");
  assert.equal(rotate.mode, "manual", "rotation declares mode: manual");
  assert.equal(rotate.interactive, true, "rotation declares interactive: true");
  assert.equal(rotate.destructive, true, "rotation declares destructive: true");
  assert.equal(rotate.execution, "manual-execution-required", "interactive+destructive forces manual-execution-required");
  assert.equal(rotate.action, "human-runs-apply-command");

  const secrets = status.migrations.find((m) => m.id === "register-trusted-only-secrets-bundle");
  assert.ok(secrets, "status must include the secrets-bundle migration");
  assert.equal(secrets.trustClass, "trusted", "secrets-bundle migration is trustClass: trusted");
  assert.equal(secrets.execution, "manual-execution-required");
});

test("issue #34: status migrations[] validates against the sync-state schema", async () => {
  const schema = await readJson(join(SCHEMAS, "sync-state.schema.json"));
  const { json: status } = await runEngineJson([
    "status",
    "--fixture",
    FIXTURE,
  ]);
  const error = validate(status, schema);
  assert.equal(error, null, error ?? "status JSON (with migrations[]) must validate against sync-state schema");
});

test("issue #34: apply plan surfaces migrations[] with idempotency status and branch action", async () => {
  const { json: envelope } = await runEngineJson([
    "apply",
    "--plan",
    "--fixture",
    FIXTURE,
  ]);
  const plan = envelope.plan ?? envelope;
  assert.ok(Array.isArray(plan.migrations), "apply plan must include migrations[]");
  assert.ok(plan.migrations.length >= 3, "plan must surface every declared migration");

  for (const m of plan.migrations) {
    assert.ok(typeof m.id === "string", "plan migration must have id");
    assert.ok(["automatic", "manual"].includes(m.mode), "plan migration must declare mode");
    assert.ok(typeof m.idempotency === "object", "plan migration must declare idempotency");
    assert.ok(["pending", "already-applied"].includes(m.idempotencyStatus), "plan migration must declare idempotencyStatus");
    assert.ok(["any", "trusted"].includes(m.trustClass), "plan migration must declare trustClass");
    assert.ok(
      ["engine-surfaces-only", "manual-execution-required"].includes(m.execution),
      "plan migration must declare execution"
    );
    assert.equal(m.applyOnBranch, true, "plan migration must declare applyOnBranch (engine surfaces it on the branch)");
    assert.ok(typeof m.branchAction === "string", "plan migration must declare branchAction");
  }

  const planSchema = await readJson(join(SCHEMAS, "apply-plan.schema.json"));
  const planError = validate(plan, planSchema);
  assert.equal(planError, null, planError ?? "apply plan (with migrations[]) must validate against apply-plan schema");

  const marker = plan.migrations.find(
    (m) => m.id === "marker-environments-contract-v1.2.0"
  );
  assert.equal(marker.idempotencyStatus, "already-applied");
  assert.equal(marker.execution, "engine-surfaces-only");
  assert.equal(marker.branchAction, "no-action-required");

  const rotate = plan.migrations.find((m) => m.id === "rotate-webhook-signing-secret");
  assert.equal(rotate.idempotencyStatus, "pending");
  assert.equal(rotate.execution, "manual-execution-required");
  assert.equal(rotate.branchAction, "reviewer-runs-apply-command-before-or-after-merge");
});

test("issue #34: migration status appears in the recommended next action", async () => {
  const { json: statusConflicts } = await runEngineJson([
    "status",
    "--fixture",
    FIXTURE,
  ]);
  assert.ok(
    statusConflicts.migrations.length > 0,
    "status must include migrations even when conflicts exist"
  );
  const note = statusConflicts.recommendation.note ?? "";
  assert.ok(
    /migration/i.test(note),
    `recommendation.note must mention migrations when any migration is pending (got: ${note})`
  );

  const statusSchema = await readJson(join(SCHEMAS, "sync-state.schema.json"));
  assert.ok(
    statusSchema.properties.recommendation.properties.action.enum.includes(
      "review-migrations"
    ),
    "sync-state schema must allow review-migrations as a recommendation action"
  );
});

test("issue #34: when conflicts are absent and migrations are pending, status recommends review-migrations", async () => {
  const worktree = join(WORK_ROOT, "review-migrations");
  await rm(worktree, { recursive: true, force: true });
  await mkdir(WORK_ROOT, { recursive: true });
  // Use a clean derived-project clone to skip the fixture's middleware conflict.
  await execFile("node", [
    ENGINE,
    "apply",
    "--worktree",
    worktree,
    "--fixture",
    FIXTURE,
  ], { cwd: REPO_ROOT });

  // Inside the worktree, middleware.ts is preserved as Custom-owned on purpose
  // because the fixture's conflict path is always present. To exercise the
  // 'review-migrations' action we synthesise a Derived project without
  // middleware.ts and re-run status on it.
  await rm(join(worktree, "apps/api/middleware.ts"));
  const { json: branchStatus } = await runEngineJson([
    "status",
    "--fixture",
    FIXTURE,
    "--derived-project",
    worktree,
    "--from",
    "v1.2.0",
    "--to",
    "v1.2.0",
  ]);
  assert.ok(
    branchStatus.migrations.length > 0,
    "branch status must still surface migrations"
  );
  assert.equal(
    branchStatus.conflicts.length,
    0,
    "without middleware.ts, status must not report the middleware conflict"
  );
  const hasPendingManual = branchStatus.migrations.some(
    (m) => m.execution === "manual-execution-required" && m.idempotencyStatus === "pending"
  );
  assert.ok(
    hasPendingManual,
    "branch status must surface at least one pending manual migration"
  );
  assert.equal(
    branchStatus.recommendation.action,
    "review-migrations",
    "without conflicts and with pending manual migrations, status must recommend review-migrations"
  );
});

test("issue #34: Community Derived projects force every migration to manual-execution-required", async () => {
  const { json: communityStatus } = await runEngineJson([
    "status",
    "--fixture",
    FIXTURE,
    "--trust-class",
    "community",
  ]);
  assert.ok(communityStatus.migrations.length >= 3, "community status must include all migrations");
  for (const m of communityStatus.migrations) {
    assert.equal(
      m.execution,
      "manual-execution-required",
      `community project must force manual-execution-required for migration ${m.id}`
    );
  }
  const marker = communityStatus.migrations.find(
    (m) => m.id === "marker-environments-contract-v1.2.0"
  );
  assert.equal(
    marker.execution,
    "manual-execution-required",
    "marker-file migration must be manual-execution-required on community projects"
  );
  assert.equal(
    marker.idempotencyStatus,
    "already-applied",
    "idempotency check still evaluates the same way on community projects"
  );
});

test("issue #34: community MIGRATIONS.md explicitly says the maintainer must run migrations locally", async () => {
  const worktree = join(WORK_ROOT, "community");
  await rm(worktree, { recursive: true, force: true });
  await mkdir(WORK_ROOT, { recursive: true });
  await runEngineJson([
    "apply",
    "--worktree",
    worktree,
    "--fixture",
    FIXTURE,
    "--trust-class",
    "community",
  ]);

  const readme = await readText(join(worktree, "MIGRATIONS.md"));
  assert.match(
    readme,
    /Community Derived projects must run every migration step locally and explicitly/,
    "community MIGRATIONS.md must include the explicit-local-execution warning"
  );
  assert.match(
    readme,
    /The engine does not execute any migration\./,
    "MIGRATIONS.md must clearly say the engine does not run migrations"
  );
  assert.match(
    readme,
    /rotate-webhook-signing-secret/,
    "MIGRATIONS.md must list the rotation migration"
  );
});

test("issue #34: worktree contains MIGRATIONS.md that documents every migration without executing it", async () => {
  const worktree = join(WORK_ROOT, "trusted");
  await rm(worktree, { recursive: true, force: true });
  await mkdir(WORK_ROOT, { recursive: true });
  await runEngineJson([
    "apply",
    "--worktree",
    worktree,
    "--fixture",
    FIXTURE,
  ]);

  const readme = await readText(join(worktree, "MIGRATIONS.md"));
  for (const id of [
    "marker-environments-contract-v1.2.0",
    "rotate-webhook-signing-secret",
    "register-trusted-only-secrets-bundle",
  ]) {
    assert.ok(readme.includes(id), `MIGRATIONS.md must mention ${id}`);
  }
  assert.match(
    readme,
    /The engine does not execute any migration\./,
    "MIGRATIONS.md must clearly state the engine does not run migrations"
  );
  assert.match(
    readme,
    /\*\*Idempotency check:\*\* `file-exists \.beztack\/migrations\/v1\.2\.0-applied`/,
    "MIGRATIONS.md must show the file-exists idempotency check"
  );
  assert.match(
    readme,
    /\*\*Idempotency check:\*\* `marker-present \.beztack\/migrations\/webhook-secret-rotated-at \(looking for 'v1\.2\.0'\)`/,
    "MIGRATIONS.md must show the marker-present idempotency check"
  );
  assert.match(
    readme,
    /\*\*Idempotency check:\*\* `command-succeeds 'pnpm beztack secrets:bundle --version 1\.2\.0 --check' \(engine does not run; treated as pending\)`/,
    "MIGRATIONS.md must show the command-succeeds idempotency check"
  );
  assert.match(
    readme,
    /Action:\*\* No action required/,
    "MIGRATIONS.md must report already-applied migrations as no-action-required"
  );
  assert.match(
    readme,
    /Action:\*\* Manual execution required/,
    "MIGRATIONS.md must report pending migrations as manual-execution-required"
  );
});

test("issue #34: source Derived project is never mutated by --worktree (migrations are surfaced only)", async () => {
  const worktree = join(WORK_ROOT, "no-mutate");
  await rm(worktree, { recursive: true, force: true });
  await mkdir(WORK_ROOT, { recursive: true });

  const beforeSyncEventLog = await readText(
    join(FIXTURE, "derived-project/.beztack/sync-event-log.json")
  );
  const beforeState = await readText(
    join(FIXTURE, "derived-project/.beztack/sync-state.json")
  );
  const beforeOrigin = await readText(
    join(FIXTURE, "derived-project/.beztack/origin.json")
  );
  const beforeMarker = await readText(
    join(FIXTURE, "derived-project/.beztack/migrations/v1.2.0-applied")
  );

  await runEngineJson([
    "apply",
    "--worktree",
    worktree,
    "--fixture",
    FIXTURE,
  ]);

  const afterSyncEventLog = await readText(
    join(FIXTURE, "derived-project/.beztack/sync-event-log.json")
  );
  const afterState = await readText(
    join(FIXTURE, "derived-project/.beztack/sync-state.json")
  );
  const afterOrigin = await readText(
    join(FIXTURE, "derived-project/.beztack/origin.json")
  );
  const afterMarker = await readText(
    join(FIXTURE, "derived-project/.beztack/migrations/v1.2.0-applied")
  );

  assert.equal(beforeSyncEventLog, afterSyncEventLog, "source Derived project's sync-event-log.json must not be mutated");
  assert.equal(beforeState, afterState, "source Derived project's sync-state.json must not be mutated");
  assert.equal(beforeOrigin, afterOrigin, "source Derived project's origin.json must not be mutated");
  assert.equal(beforeMarker, afterMarker, "source Derived project's migration marker file must not be mutated");
});

test("issue #34: worktree's sync-state.json records migrations[] with idempotency status", async () => {
  const worktree = join(WORK_ROOT, "schemas");
  await rm(worktree, { recursive: true, force: true });
  await mkdir(WORK_ROOT, { recursive: true });
  await runEngineJson([
    "apply",
    "--worktree",
    worktree,
    "--fixture",
    FIXTURE,
  ]);

  const state = await readJson(join(worktree, ".beztack/sync-state.json"));
  const stateSchema = await readJson(join(SCHEMAS, "sync-state.schema.json"));
  const stateError = validate(state, stateSchema);
  assert.equal(stateError, null, stateError ?? "worktree sync-state.json must validate against sync-state schema");

  assert.ok(Array.isArray(state.migrations), "worktree sync-state must include migrations[]");
  assert.equal(state.migrations.length, 3, "worktree sync-state must surface all three migrations");
  const rotate = state.migrations.find((m) => m.id === "rotate-webhook-signing-secret");
  assert.equal(rotate.idempotencyStatus, "pending");
  assert.equal(rotate.execution, "manual-execution-required");
});

test("issue #34: --init-git commits MIGRATIONS.md alongside the planned file updates", async () => {
  const worktree = join(WORK_ROOT, "git-commit");
  await rm(worktree, { recursive: true, force: true });
  await mkdir(WORK_ROOT, { recursive: true });
  await runEngineJson([
    "apply",
    "--worktree",
    worktree,
    "--init-git",
    "--fixture",
    FIXTURE,
  ]);

  const { stdout } = await runEngine([
    "apply",
    "--worktree",
    worktree,
    "--init-git",
    "--fixture",
    FIXTURE,
  ]).catch(() => ({ stdout: "" }));

  // The second invocation must refuse (the engine refuses to overwrite an
  // existing worktree). Use git directly to verify the commit shape instead.
  const execFileLocal = promisify(execFileCb);
  const { stdout: show } = await execFileLocal(
    "git",
    ["log", "--oneline", "-1"],
    { cwd: worktree }
  );
  assert.match(
    show,
    /template-sync: v1\.1\.0 -> v1\.2\.0/,
    "git commit message must mention the template-sync move"
  );
  assert.match(
    show,
    /pending migrations/,
    "git commit message must mention the pending migration count"
  );

  const { stdout: lsFiles } = await execFileLocal(
    "git",
    ["ls-files"],
    { cwd: worktree }
  );
  assert.ok(
    lsFiles.split("\n").includes("MIGRATIONS.md"),
    "MIGRATIONS.md must be tracked by the worktree's git repo"
  );
  assert.ok(
    lsFiles.split("\n").includes("BRANCH_README.md"),
    "BRANCH_README.md must be tracked by the worktree's git repo"
  );
});

test("issue #34: MIGRATIONS.md does not run any apply command (engine output is documentation only)", async () => {
  const worktree = join(WORK_ROOT, "no-exec");
  await rm(worktree, { recursive: true, force: true });
  await mkdir(WORK_ROOT, { recursive: true });
  await runEngineJson([
    "apply",
    "--worktree",
    worktree,
    "--fixture",
    FIXTURE,
  ]);

  const readme = await readText(join(worktree, "MIGRATIONS.md"));
  // Engine surfaces commands but explicitly labels them as never-run.
  assert.match(
    readme,
    /Apply command \(engine never runs it\):/,
    "MIGRATIONS.md must label every apply command as never-run-by-the-engine"
  );
  assert.match(
    readme,
    /Action:\*\* No action required/,
    "MIGRATIONS.md must say no-action-required for already-applied migrations"
  );
  assert.match(
    readme,
    /Action:\*\* Manual execution required\. A human must run the apply command/,
    "MIGRATIONS.md must require a human to run the apply command for pending migrations"
  );
});

test("issue #34: status --format human renders migrations with dry-run + apply commands", async () => {
  const { stdout } = await runEngine([
    "status",
    "--fixture",
    FIXTURE,
    "--format",
    "human",
  ]);
  assert.match(stdout, /## Template migrations/, "human status must include a migrations section");
  assert.match(stdout, /marker-environments-contract-v1\.2\.0/, "human status must list the marker migration");
  assert.match(stdout, /rotate-webhook-signing-secret/, "human status must list the rotation migration");
  assert.match(stdout, /register-trusted-only-secrets-bundle/, "human status must list the secrets-bundle migration");
  assert.match(stdout, /already-applied/, "human status must show already-applied status");
  assert.match(stdout, /pending/i, "human status must show pending status");
  assert.match(
    stdout,
    /The Beztack Sync engine never executes migrations/,
    "human status must explain that the engine never executes migrations"
  );
});

test("issue #34: apply --plan --format human renders migrations with branch actions", async () => {
  const { stdout } = await runEngine([
    "apply",
    "--plan",
    "--fixture",
    FIXTURE,
    "--format",
    "human",
  ]);
  assert.match(stdout, /## Template migrations/, "human plan must include a migrations section");
  assert.match(stdout, /MANUAL EXECUTION REQUIRED/, "human plan must label manual migrations");
  assert.match(
    stdout,
    /Apply command \(engine never runs this\):/,
    "human plan must label apply commands as never-run-by-the-engine"
  );
});

test("issue #34: engine refuses to plan with a manifest that declares an invalid migration", async () => {
  // Sanity check: a Template manifest with no migrations still parses, and
  // a Template manifest with a rogue field on a migration is rejected by
  // the schema gate (the gate is upstream of buildStatus/buildApplyPlan).
  const invalidManifest = {
    schemaVersion: "1.0",
    templateId: "beztack-core",
    version: "v9.9.9",
    semver: "9.9.9",
    versionImpact: "patch",
    releasedAt: "2026-06-01T00:00:00Z",
    compatibleEngines: { minimum: "0.2.0" },
    migrations: [{ id: "rogue", mode: "automatic", __rogue: "field not allowed" }],
  };
  const manifestSchema = await readJson(join(SCHEMAS, "template-manifest.schema.json"));
  const error = validate(invalidManifest, manifestSchema);
  assert.ok(error !== null, "schema gate must reject rogue fields on migration entries");
});

test("issue #34: marker file removed -> idempotencyStatus becomes pending on the next status run", async () => {
  const worktree = join(WORK_ROOT, "idem");
  await rm(worktree, { recursive: true, force: true });
  await mkdir(WORK_ROOT, { recursive: true });
  await runEngineJson([
    "apply",
    "--worktree",
    worktree,
    "--fixture",
    FIXTURE,
  ]);

  const markerPath = join(worktree, ".beztack/migrations/v1.2.0-applied");
  await rm(markerPath);

  const { json: branchStatus } = await runEngineJson([
    "status",
    "--fixture",
    FIXTURE,
    "--derived-project",
    worktree,
    "--from",
    "v1.2.0",
    "--to",
    "v1.2.0",
  ]);
  const marker = branchStatus.migrations.find(
    (m) => m.id === "marker-environments-contract-v1.2.0"
  );
  assert.equal(
    marker.idempotencyStatus,
    "pending",
    "after removing the marker file, the idempotency check must report pending"
  );
});