/**
 * Tests for the Trusted Derived project registry and identity contract
 * (issue #32).
 *
 * Validates the Beztack Sync engine prototype against the registry
 * contract:
 *
 *   - The Beztack-owned registry file (not the Derived project tree) is
 *     the source of truth for trust.
 *   - Trust decisions are one-way: a Derived project owner cannot
 *     self-declare trusted status by reusing the ID.
 *   - The registry exposes enough metadata to identify trusted
 *     repositories (canonical URL + rename history) and trust class.
 *   - Trusted Derived projects are targetable for automated update
 *     notification (canonical URL is in the registry entry).
 *   - Community Derived projects remain supported through local tooling
 *     without Beztack-held permissions.
 *   - Stable opaque Derived project IDs survive repository renames and
 *     remote URL changes.
 *   - All outputs validate against the schema-versioned Sync state
 *     contract.
 *
 * Runs with Node's built-in test runner:
 *   node --test docs/template-sync-spike/custom-engine/tests/identity-registry.test.mjs
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
import { dirname, join, resolve, basename } from "node:path";

const execFile = promisify(execFileCb);
const here = dirname(fileURLToPath(import.meta.url));
const ENGINE_DIR = resolve(here, "..");
const REPO_ROOT = resolve(ENGINE_DIR, "../../..");
const FIXTURE = join(REPO_ROOT, "docs/template-sync-fixture");
const ENGINE = join(ENGINE_DIR, "beztack-sync.mjs");
const REGISTRY_PATH = join(FIXTURE, "beztack/derived-project-registry.json");
const SCHEMAS = join(FIXTURE, "schemas");
const REGISTRY_MODULE = join(ENGINE_DIR, "registry.mjs");
const WORK_ROOT = "/tmp/opencode/beztack-identity-test";

const TRUSTED_ID = "dp_01HMVBEZTACK0000000000000A";
const ANOTHER_TRUSTED_ID = "dp_01HMVBEZTACK0000000000000B";
const REVOKED_ID = "dp_01HMVBEZTACK0000000000000R";
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

/**
 * Minimal JSON Schema validator (type, const, enum, required,
 * additionalProperties, properties, items, $ref, $defs, oneOf, allOf,
 * pattern, date-time format). Mirrors the validator in apply-flow /
 * migration-flow tests so each test file stays self-contained.
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

test("issue #32: Beztack-owned registry file exists outside the Derived project tree", async () => {
  const registry = await readJson(REGISTRY_PATH);
  assert.equal(registry.schemaVersion, "1.0");
  assert.equal(typeof registry.registryId, "string");
  assert.equal(typeof registry.registryVersion, "string");
  assert.equal(registry.templateId, "beztack-core");
  assert.ok(Array.isArray(registry.entries) && registry.entries.length >= 2);

  const derivedProjectTree = join(FIXTURE, "derived-project");
  const dpEntries = await readdir(derivedProjectTree, { recursive: true });
  assert.ok(
    !dpEntries.some((p) => p.includes(basename(REGISTRY_PATH))),
    "registry file must NOT live inside the Derived project tree"
  );
  const beztackOwnedDir = join(FIXTURE, "beztack");
  assert.ok(
    await pathExists(beztackOwnedDir),
    "registry must live under a Beztack-owned directory next to the fixture"
  );
});

test("issue #32: registry file validates against the derived-project-registry schema", async () => {
  const schema = await readJson(
    join(SCHEMAS, "derived-project-registry.schema.json")
  );
  const registry = await readJson(REGISTRY_PATH);
  const error = validate(registry, schema);
  assert.equal(error, null, error ?? "registry file must validate against its schema");
});

test("issue #32: registry rejects rogue fields on entries (locked-down contract)", async () => {
  const schema = await readJson(
    join(SCHEMAS, "derived-project-registry.schema.json")
  );
  const rogue = JSON.parse(JSON.stringify(await readJson(REGISTRY_PATH)));
  rogue.entries[0].__rogueField = "engine must reject this";
  const error = validate(rogue, schema);
  assert.ok(
    error !== null && error.includes("__rogueField"),
    `registry schema must reject unexpected entry fields; got: ${error}`
  );
});

test("issue #32: registry rejects unsupported schemaVersion", async () => {
  const schema = await readJson(
    join(SCHEMAS, "derived-project-registry.schema.json")
  );
  const rogue = JSON.parse(JSON.stringify(await readJson(REGISTRY_PATH)));
  rogue.schemaVersion = "2.0";
  const error = validate(rogue, schema);
  assert.ok(error !== null, "registry must reject unsupported schemaVersion");
});

test("issue #32: registry entries record canonicalUrl, knownUrls, and trust class metadata", async () => {
  const registry = await readJson(REGISTRY_PATH);
  const entry = registry.entries.find((e) => e.derivedProjectId === TRUSTED_ID);
  assert.ok(entry, "fixture must include a Trusted entry for the canonical Derived project ID");
  assert.equal(entry.trustClass, "trusted");
  assert.equal(entry.repository.canonicalUrl, "https://github.com/beztack/lncd");
  assert.ok(Array.isArray(entry.repository.knownUrls));
  assert.ok(entry.repository.knownUrls.length >= 1, "every entry must list at least the canonical URL");
  assert.equal(entry.repository.knownUrls[0], entry.repository.canonicalUrl);
  assert.ok(typeof entry.addedAt === "string");
  assert.ok(typeof entry.addedBy === "string");
});

test("issue #32: stable opaque Derived project ID is generated once and shared across artifacts", async () => {
  const origin = await readJson(join(FIXTURE, "derived-project/.beztack/origin.json"));
  const state = await readJson(join(FIXTURE, "expected/status.json"));
  const promo = await readJson(join(FIXTURE, "expected/promotion-metadata.json"));
  const log = await readJson(join(FIXTURE, "derived-project/.beztack/sync-event-log.json"));

  assert.equal(typeof origin.derivedProjectId, "string");
  assert.ok(origin.derivedProjectId.length > 0);
  assert.equal(origin.derivedProjectId, state.derivedProjectId);
  assert.equal(origin.derivedProjectId, promo.derivedProjectId);
  assert.equal(origin.derivedProjectId, log.derivedProjectId);
  assert.equal(origin.derivedProjectId, TRUSTED_ID);
  assert.ok(!origin.derivedProjectId.includes("lncd"), "Derived project ID must NOT be derived from the repo name");
  assert.ok(!origin.derivedProjectId.includes("github"), "Derived project ID must NOT be derived from the remote URL");
  assert.match(origin.derivedProjectId, /^dp_[A-Z0-9]+$/, "Derived project ID must be opaque (no semantic prefix beyond dp_)");
});

test("issue #32: Derived project ID stays stable when the canonical URL changes (rename traceability)", async () => {
  const registry = await readJson(REGISTRY_PATH);
  const entry = registry.entries.find((e) => e.derivedProjectId === TRUSTED_ID);
  assert.ok(entry, "fixture must include a Trusted entry with rename history");
  assert.ok(
    entry.repository.knownUrls.length >= 2,
    "the Trusted entry must record the rename history in knownUrls"
  );
  assert.ok(
    entry.repository.knownUrls.includes("https://github.com/beztack/lncd"),
    "knownUrls must include the current canonical URL"
  );
  assert.ok(
    entry.repository.knownUrls.includes("https://github.com/V473r10/lncd"),
    "knownUrls must include the previous URL after the rename"
  );
  assert.equal(
    entry.repository.knownUrls[entry.repository.knownUrls.length - 1] !== entry.repository.canonicalUrl,
    true,
    "rename history must include at least one URL different from the canonical URL"
  );

  // The Origin baseline, Sync state, and Sync event log all keep the same
  // derivedProjectId even though the canonical URL changed.
  const origin = await readJson(join(FIXTURE, "derived-project/.beztack/origin.json"));
  assert.equal(origin.derivedProjectId, TRUSTED_ID);
});

test("issue #32: status output surfaces registry metadata for trusted entries", async () => {
  const { json: status } = await runEngineJson([
    "status",
    "--fixture",
    FIXTURE,
  ]);
  assert.ok(status.trust, "status must include the trust block");
  assert.equal(status.trust.trustClass, "trusted");
  assert.equal(status.trust.effectiveTrustClass, "trusted");
  assert.equal(status.trust.trustOverriddenByCaller, false);
  assert.equal(status.trust.source, "registry-listed");
  assert.equal(status.trust.registryId, "beztack-public-trust-registry");
  assert.match(
    status.trust.registryVersion,
    /^[0-9]+\.[0-9]+\.[0-9]+/,
    "registryVersion must be version-shaped"
  );
  assert.ok(status.trust.repository, "trusted entries must surface the repository");
  assert.equal(status.trust.repository.canonicalUrl, "https://github.com/beztack/lncd");
  assert.ok(
    status.trust.repository.knownUrls.length >= 2,
    "trusted entries must surface the rename history"
  );
  assert.equal(status.trust.repository.displayName, "lncd");

  const stateSchema = await readJson(join(SCHEMAS, "sync-state.schema.json"));
  const stateError = validate(status, stateSchema);
  assert.equal(
    stateError,
    null,
    stateError ?? "status JSON (with trust block) must validate against sync-state schema"
  );
});

test("issue #32: apply plan output surfaces registry metadata and validates against apply-plan schema", async () => {
  const { json: envelope } = await runEngineJson([
    "apply",
    "--plan",
    "--fixture",
    FIXTURE,
  ]);
  const plan = envelope.plan ?? envelope;
  assert.ok(plan.trust, "apply plan must include the trust block");
  assert.equal(plan.trust.trustClass, "trusted");
  assert.equal(plan.trust.source, "registry-listed");
  assert.ok(plan.trust.repository);

  const planSchema = await readJson(join(SCHEMAS, "apply-plan.schema.json"));
  const planError = validate(plan, planSchema);
  assert.equal(
    planError,
    null,
    planError ?? "apply plan (with trust block) must validate against apply-plan schema"
  );
});

test("issue #32: promotion-metadata output records registry decision in both trustClass and trust", async () => {
  const { json: promo } = await runEngineJson([
    "promotion-metadata",
    "--fixture",
    FIXTURE,
  ]);
  assert.equal(promo.trustClass, "trusted");
  assert.ok(promo.trust, "promotion metadata must include the structured trust block");
  assert.equal(promo.trust.trustClass, "trusted");
  assert.equal(promo.trust.effectiveTrustClass, "trusted");
  assert.equal(promo.trust.trustOverriddenByCaller, false);
  assert.equal(promo.trust.source, "registry-listed");
  assert.ok(promo.trust.repository);

  const promoSchema = await readJson(join(SCHEMAS, "promotion-metadata.schema.json"));
  const promoError = validate(promo, promoSchema);
  assert.equal(
    promoError,
    null,
    promoError ?? "promotion metadata (with trust block) must validate against promotion-metadata schema"
  );
});

test("issue #32: worktree's sync-state.json records the registry decision", async () => {
  const worktree = join(WORK_ROOT, "worktree-trust");
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
  assert.ok(state.trust, "worktree sync-state must include the trust block");
  assert.equal(state.trust.trustClass, "trusted");
  assert.equal(state.trust.source, "registry-listed");

  const stateSchema = await readJson(join(SCHEMAS, "sync-state.schema.json"));
  const stateError = validate(state, stateSchema);
  assert.equal(
    stateError,
    null,
    stateError ?? "worktree sync-state.json (with trust block) must validate"
  );

  const readme = await readText(join(worktree, "BRANCH_README.md"));
  assert.match(readme, /\*\*Trust class:\*\* `trusted`/, "BRANCH_README must include the trust class");
  assert.match(readme, /rename/i, "BRANCH_README must explain rename traceability");
  assert.match(readme, /opaque stable identifier/, "BRANCH_README must explain the opaque ID invariant");
});

test("issue #32: a Derived project whose ID is absent from the registry defaults to community", async () => {
  const cloneDir = join(WORK_ROOT, "unknown");
  await copyFixtureDerivedProject(cloneDir);
  await rewriteDerivedProjectId(cloneDir, UNKNOWN_ID);

  const { json: status } = await runEngineJson([
    "status",
    "--fixture",
    FIXTURE,
    "--derived-project",
    cloneDir,
    "--from",
    "v1.1.0",
    "--to",
    "v1.1.0",
  ]);
  assert.equal(status.trust.trustClass, "community");
  assert.equal(status.trust.source, "registry-absent-default-community");
  assert.equal(status.trust.effectiveTrustClass, "community");
  assert.equal(status.trust.repository, null);
  assert.match(
    status.trust.note,
    /community/i,
    "community-default note must explain the fallback"
  );

  // The recommendation still mentions Community support, and the
  // Sync state schema still validates.
  const stateSchema = await readJson(join(SCHEMAS, "sync-state.schema.json"));
  const stateError = validate(status, stateSchema);
  assert.equal(stateError, null, stateError ?? "community status must still validate against sync-state schema");
});

test("issue #32: Community Derived projects are supported through local tooling (engine still runs)", async () => {
  const cloneDir = join(WORK_ROOT, "community-runs");
  await copyFixtureDerivedProject(cloneDir);
  await rewriteDerivedProjectId(cloneDir, UNKNOWN_ID);

  // status is allowed.
  const { json: status } = await runEngineJson([
    "status",
    "--fixture",
    FIXTURE,
    "--derived-project",
    cloneDir,
    "--from",
    "v1.1.0",
    "--to",
    "v1.1.0",
  ]);
  assert.equal(status.trust.trustClass, "community");

  // apply --plan is allowed.
  const { json: envelope } = await runEngineJson([
    "apply",
    "--plan",
    "--fixture",
    FIXTURE,
    "--derived-project",
    cloneDir,
  ]);
  const plan = envelope.plan ?? envelope;
  assert.equal(plan.trust.trustClass, "community");
  assert.equal(plan.trust.source, "registry-absent-default-community");

  // Promotion metadata is allowed.
  const { json: promo } = await runEngineJson([
    "promotion-metadata",
    "--fixture",
    FIXTURE,
    "--derived-project",
    cloneDir,
  ]);
  assert.equal(promo.trustClass, "community");
  assert.equal(promo.trust.source, "registry-absent-default-community");

  // The recommendation note explains how community projects consume
  // updates without Beztack-held permissions.
  const human = await runEngine([
    "status",
    "--fixture",
    FIXTURE,
    "--derived-project",
    cloneDir,
    "--from",
    "v1.1.0",
    "--to",
    "v1.1.0",
    "--format",
    "human",
  ]);
  assert.match(human.stdout, /Beztack registry/i, "human view must include the registry section");
  assert.match(human.stdout, /Community fallback/, "human view must explain the Community fallback");
});

test("issue #32: --trust-class trusted is refused when the ID is absent from the registry", async () => {
  const cloneDir = join(WORK_ROOT, "refused-trust");
  await copyFixtureDerivedProject(cloneDir);
  await rewriteDerivedProjectId(cloneDir, UNKNOWN_ID);

  const { code, stderr } = await runEngineExpectFailure([
    "status",
    "--fixture",
    FIXTURE,
    "--derived-project",
    cloneDir,
    "--trust-class",
    "trusted",
  ]);
  assert.equal(code, 5, "engine must exit 5 on trust escalation refusal");
  assert.match(stderr, /Refused to grant trust class "trusted"/);
  assert.match(stderr, /not on the Beztack-owned registry/);
});

test("issue #32: --trust-class community is allowed as a downgrade for a trusted ID (testing/simulation)", async () => {
  // Trusted ID + --trust-class community → effective community, registry
  // grant unchanged.
  const { json: status } = await runEngineJson([
    "status",
    "--fixture",
    FIXTURE,
    "--trust-class",
    "community",
  ]);
  assert.equal(status.trust.trustClass, "trusted", "registry grant must remain trusted");
  assert.equal(status.trust.effectiveTrustClass, "community", "effective class must reflect the caller's downgrade");
  assert.equal(status.trust.trustOverriddenByCaller, true);
});

test("issue #32: copied Community Derived project with same trusted ID does NOT receive trusted status", async () => {
  // Simulate a fork that copies the Trusted ID without Beztack's grant:
  // the registry still records the original Trusted entry, but the
  // copy can be told apart by an unmatched canonical URL or by
  // removing the entry from the registry. The engine must treat
  // unknown IDs as community even if the ID format matches a known
  // trusted ID.
  const cloneDir = join(WORK_ROOT, "copy");
  await copyFixtureDerivedProject(cloneDir);
  // Keep the ID but remove the registry entry to simulate a fork that
  // escaped the registry.
  const tamperedRegistry = JSON.parse(JSON.stringify(await readJson(REGISTRY_PATH)));
  tamperedRegistry.entries = tamperedRegistry.entries.filter(
    (e) => e.derivedProjectId !== TRUSTED_ID
  );
  const tmpRegistry = join(WORK_ROOT, "registry-without-trusted.json");
  await writeFile(tmpRegistry, JSON.stringify(tamperedRegistry, null, 2) + "\n", "utf8");

  const { json: status } = await runEngineJson([
    "status",
    "--fixture",
    FIXTURE,
    "--derived-project",
    cloneDir,
    "--registry",
    tmpRegistry,
  ]);
  assert.equal(
    status.trust.source,
    "registry-absent-default-community",
    "a copy without a registry entry must default to community"
  );
  assert.equal(status.trust.trustClass, "community");
  assert.equal(status.trust.effectiveTrustClass, "community");

  // And the same copy attempting --trust-class trusted is refused.
  const { code, stderr } = await runEngineExpectFailure([
    "status",
    "--fixture",
    FIXTURE,
    "--derived-project",
    cloneDir,
    "--registry",
    tmpRegistry,
    "--trust-class",
    "trusted",
  ]);
  assert.equal(code, 5, "engine must refuse self-declared trust for a copied project");
  assert.match(stderr, /Refused to grant trust class "trusted"/);
});

test("issue #32: revoked registry entries default to community (audit-only)", async () => {
  const tamperedRegistry = JSON.parse(JSON.stringify(await readJson(REGISTRY_PATH)));
  // Wipe every entry except the revoked one so the lookup is isolated.
  tamperedRegistry.entries = tamperedRegistry.entries.filter(
    (e) => e.derivedProjectId === REVOKED_ID
  );
  const tmpRegistry = join(WORK_ROOT, "registry-revoked.json");
  await writeFile(tmpRegistry, JSON.stringify(tamperedRegistry, null, 2) + "\n", "utf8");

  const cloneDir = join(WORK_ROOT, "revoked");
  await copyFixtureDerivedProject(cloneDir);
  await rewriteDerivedProjectId(cloneDir, REVOKED_ID);

  const { json: status } = await runEngineJson([
    "status",
    "--fixture",
    FIXTURE,
    "--derived-project",
    cloneDir,
    "--registry",
    tmpRegistry,
  ]);
  assert.equal(status.trust.source, "registry-revoked-default-community");
  assert.equal(status.trust.trustClass, "community");
  assert.match(status.trust.note, /revoked/);

  // The repository metadata still flows through so the audit log shows
  // what the original grant was.
  assert.ok(status.trust.repository, "revoked entries must still expose repository metadata for audit");
});

test("issue #32: engine refuses to plan without the registry file (Beztack-owned, not optional)", async () => {
  const tmpRegistry = join(WORK_ROOT, "does-not-exist.json");
  const { code, stderr } = await runEngineExpectFailure([
    "status",
    "--fixture",
    FIXTURE,
    "--registry",
    tmpRegistry,
  ]);
  assert.equal(code, 5, "engine must exit 5 when the registry is missing");
  assert.match(stderr, /registry not found/);
});

test("issue #32: Trusted Derived projects are targetable for automated update notification (canonical URL exposed)", async () => {
  const registry = await readJson(REGISTRY_PATH);
  const trustedEntries = registry.entries.filter(
    (e) => !e.revokedAt && e.trustClass === "trusted"
  );
  assert.ok(trustedEntries.length >= 2, "fixture must include at least two non-revoked Trusted entries");
  for (const entry of trustedEntries) {
    assert.ok(
      entry.repository.canonicalUrl.startsWith("https://"),
      "canonical URL must be targetable for automated dispatch"
    );
    assert.ok(
      entry.repository.canonicalUrl.length > 0,
      "every Trusted entry must record the canonical URL"
    );
  }

  // The status output for a Trusted project exposes the canonical URL
  // so Beztack-owned tooling can target it.
  const { json: status } = await runEngineJson([
    "status",
    "--fixture",
    FIXTURE,
  ]);
  assert.equal(status.trust.repository.canonicalUrl, "https://github.com/beztack/lncd");
});

test("issue #32: registry.mjs resolves trust classes per spec", async () => {
  const { resolveTrustClass } = await import(REGISTRY_MODULE);
  const registry = { value: await readJson(REGISTRY_PATH) };

  const trusted = resolveTrustClass(registry, TRUSTED_ID);
  assert.equal(trusted.trustClass, "trusted");
  assert.equal(trusted.source, "registry-listed");
  assert.ok(trusted.entry);
  assert.equal(trusted.entry.repository.canonicalUrl, "https://github.com/beztack/lncd");

  const revoked = resolveTrustClass(registry, REVOKED_ID);
  assert.equal(revoked.trustClass, "community");
  assert.equal(revoked.source, "registry-revoked-default-community");
  assert.match(revoked.note, /revoked/);

  const unknown = resolveTrustClass(registry, UNKNOWN_ID);
  assert.equal(unknown.trustClass, "community");
  assert.equal(unknown.source, "registry-absent-default-community");
  assert.equal(unknown.entry, null);
  assert.match(unknown.note, /not on the Beztack-owned registry/);
});

test("issue #32: registry.mjs refuses trust escalation beyond the registry grant", async () => {
  const { assertRegistryMatches, RegistryError } = await import(REGISTRY_MODULE);
  const registry = { value: await readJson(REGISTRY_PATH) };

  // Trusted ID + request trusted → allowed.
  const trustedResolved = {
    trustClass: "trusted",
    source: "registry-listed",
    note: "ok",
  };
  assert.equal(
    assertRegistryMatches(TRUSTED_ID, trustedResolved, "trusted"),
    null
  );
  // Trusted ID + request community → allowed (downgrade for one run).
  assert.equal(
    assertRegistryMatches(TRUSTED_ID, trustedResolved, "community"),
    null
  );

  // Unknown ID + request trusted → refused.
  const unknownResolved = {
    trustClass: "community",
    source: "registry-absent-default-community",
    note: "missing",
  };
  assert.throws(
    () => assertRegistryMatches(UNKNOWN_ID, unknownResolved, "trusted"),
    (err) => {
      assert.ok(err instanceof RegistryError, "must throw a RegistryError");
      assert.equal(err.code, "trust-escalation-refused");
      assert.match(err.message, /Refused to grant trust class "trusted"/);
      return true;
    }
  );

  // Revoked ID + request trusted → refused.
  const revokedResolved = {
    trustClass: "community",
    source: "registry-revoked-default-community",
    note: "revoked",
  };
  assert.throws(
    () => assertRegistryMatches(REVOKED_ID, revokedResolved, "trusted"),
    (err) => {
      assert.equal(err.code, "trust-escalation-refused");
      assert.match(err.message, /revoked/);
      return true;
    }
  );
});

test("issue #32: registry.mjs formatRegistryNotice renders a human-readable block", async () => {
  const { resolveTrustClass, formatRegistryNotice } = await import(REGISTRY_MODULE);
  const registry = { value: await readJson(REGISTRY_PATH) };
  const resolved = resolveTrustClass(registry, TRUSTED_ID);
  const block = formatRegistryNotice({ resolved, registry });
  assert.match(block, /`beztack-public-trust-registry`/, "block must surface registryId");
  assert.match(block, /Trust class.*`trusted`/, "block must surface the trust class");
  assert.match(block, /Trust source.*`registry-listed`/, "block must surface the trust source");
  assert.match(block, /https:\/\/github\.com\/beztack\/lncd/, "block must surface the canonical URL");
  assert.match(block, /Known remote URLs \(rename history\)/, "block must surface the rename history");
});

test("issue #32: human-readable status includes the trust section and rename hint", async () => {
  const { stdout } = await runEngine([
    "status",
    "--fixture",
    FIXTURE,
    "--format",
    "human",
  ]);
  assert.match(stdout, /## Beztack registry \(trust source\)/);
  assert.match(stdout, /`registry-listed`/);
  assert.match(stdout, /https:\/\/github\.com\/beztack\/lncd/);
  assert.match(stdout, /Known remote URLs \(rename history\)/);
});

test("issue #32: schemas refuse additional properties on the trust block (locked-down contract)", async () => {
  const stateSchema = await readJson(join(SCHEMAS, "sync-state.schema.json"));
  const rogue = JSON.parse(JSON.stringify(await readJson(join(FIXTURE, "expected/status.json"))));
  rogue.trust.__rogueField = "engine must reject this";
  const error = validate(rogue, stateSchema);
  assert.ok(
    error !== null && error.includes("__rogueField"),
    `sync-state schema must reject rogue fields on the trust block; got: ${error}`
  );
});