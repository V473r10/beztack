/**
 * Self-check for the Template sync engine contract fixture.
 *
 * Runs with Node's built-in test runner (node --test) so no external
 * dependencies are required. Validates that the fixture is internally
 * consistent and that the expected outputs reference paths that exist.
 *
 * Usage:
 *   node --test docs/template-sync-fixture/tests/fixture.test.mjs
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, relative } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const SCHEMAS = join(ROOT, "schemas");
const DERIVED = join(ROOT, "derived-project");
const REVISIONS = join(ROOT, "template-revisions");
const EXPECTED = join(ROOT, "expected");

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function readText(path) {
  return readFile(path, "utf8");
}

function sha256(text) {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

async function fileHash(path) {
  return sha256(await readText(path));
}

const SCHEMA_FILES = {
  "sync-policy": "sync-policy.schema.json",
  "origin-baseline": "origin-baseline.schema.json",
  "sync-state": "sync-state.schema.json",
  "apply-plan": "apply-plan.schema.json",
  "promotion-metadata": "promotion-metadata.schema.json",
  "sync-event-log": "sync-event-log.schema.json",
  "template-manifest": "template-manifest.schema.json",
};

function pathSegments(fileURL) {
  return fileURL.replace(/^file:\/\//, "").split("/").filter(Boolean);
}

function normalize(p) {
  return p.split("/").filter(Boolean).join("/");
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

/**
 * Minimal JSON Schema validator covering the subset used by this fixture:
 * type, const, enum, required, additionalProperties, properties, items,
 * $ref, $defs, oneOf, allOf, pattern, and string format checks
 * (date-time, uri). Errors carry a JSON Pointer.
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

    if (typeof node.$ref === "string") {
      return build(resolveRef(node.$ref), pointer);
    }
    if (node.properties && typeof node.properties === "object") {
      for (const key of Object.keys(node.properties)) {
        subValidators[key] = build(node.properties[key], `${pointer}/${key}`);
      }
    }
    if (node.items && typeof node.items === "object") {
      itemsValidator = build(node.items, `${pointer}/items`);
    }
    if (Array.isArray(node.oneOf)) {
      oneOfValidators = node.oneOf.map((n, i) =>
        build(n, `${pointer}/oneOf/${i}`)
      );
    }
    if (Array.isArray(node.allOf)) {
      allOfValidators = node.allOf.map((n, i) =>
        build(n, `${pointer}/allOf/${i}`)
      );
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
        if (!node.enum.some((option) => JSON.stringify(option) === JSON.stringify(value))) {
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
          if (error) {
            return error;
          }
        }
      }
      if (node.type === "array" || itemsValidator) {
        if (!Array.isArray(value)) {
          return null;
        }
        if (itemsValidator) {
          for (let i = 0; i < value.length; i += 1) {
            const error = itemsValidator(value[i]);
            if (error) {
              return `${error} (at index ${i})`;
            }
          }
        }
      }
      if (typeof node.format === "string" && typeof value === "string") {
        if (node.format === "date-time" && Number.isNaN(Date.parse(value))) {
          return `${pointer} must be a valid date-time`;
        }
        if (node.format === "uri") {
          try {
            new URL(value);
          } catch {
            return `${pointer} must be a valid URI`;
          }
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
  const fn = compileSchema(schema);
  return fn(value);
}

test("schemas are themselves valid JSON", async () => {
  for (const [name, file] of Object.entries(SCHEMA_FILES)) {
    const schema = await readJson(join(SCHEMAS, file));
    assert.equal(typeof schema, "object", `${name} schema must be an object`);
    assert.ok(typeof schema.title === "string" && schema.title.length > 0, `${name} schema must have a title`);
    assert.equal(schema.properties?.schemaVersion?.const, "1.0", `${name} schema must pin schemaVersion to "1.0"`);
  }
});

for (const [name, file] of Object.entries(SCHEMA_FILES)) {
  test(`${name} fixture file validates against its schema`, async () => {
    const schema = await readJson(join(SCHEMAS, file));
    let value;
    if (name === "sync-policy") {
      value = await readJson(join(DERIVED, ".beztack/template.json"));
    } else if (name === "origin-baseline") {
      value = await readJson(join(DERIVED, ".beztack/origin.json"));
    } else if (name === "sync-state") {
      value = await readJson(join(EXPECTED, "status.json"));
    } else if (name === "apply-plan") {
      value = await readJson(join(EXPECTED, "apply-plan.json"));
    } else if (name === "promotion-metadata") {
      value = await readJson(join(EXPECTED, "promotion-metadata.json"));
    } else if (name === "sync-event-log") {
      value = await readJson(join(DERIVED, ".beztack/sync-event-log.json"));
    } else if (name === "template-manifest") {
      value = await readJson(join(REVISIONS, "v1.2.0", "template.json"));
    }
    const error = validate(value, schema);
    assert.equal(error, null, error ?? "");
  });
}

test("Origin baseline templateHashes match the v1.1.0 Template source files", async () => {
  const origin = await readJson(join(DERIVED, ".beztack/origin.json"));
  for (const [path, meta] of Object.entries(origin.files)) {
    const filePath = join(REVISIONS, "v1.1.0", path);
    const actual = await fileHash(filePath);
    assert.equal(
      actual,
      meta.templateHash,
      `templateHash mismatch for ${path} (expected ${meta.templateHash}, got ${actual})`
    );
  }
});

test("Origin baseline projectHashes match v1.1.0 at acceptance time", async () => {
  const origin = await readJson(join(DERIVED, ".beztack/origin.json"));
  for (const [path, meta] of Object.entries(origin.files)) {
    const filePath = join(REVISIONS, "v1.1.0", path);
    const v110Hash = await fileHash(filePath);
    assert.equal(
      meta.projectHash,
      meta.templateHash,
      `projectHash must equal templateHash at acceptance (path ${path})`
    );
    assert.equal(
      meta.projectHash,
      v110Hash,
      `projectHash must match the v1.1.0 file at acceptance (path ${path})`
    );
  }
});

test("Drift detection: at least one file in sync-state has each drift class", async () => {
  const state = await readJson(join(EXPECTED, "status.json"));
  const drifts = new Set(Object.values(state.files).map((entry) => entry.drift));
  for (const expected of ["template-changed", "project-changed", "both-changed", "added"]) {
    assert.ok(drifts.has(expected), `sync-state must include a file with drift=${expected}`);
  }
});

test("Template v1.2.0 differs from v1.1.0 only where expected", async () => {
  const changed = [
    "packages/auth/session.ts",
    "apps/api/routes.ts",
    ".env.contract.json",
    "package.json",
  ];
  const added = ["apps/api/middleware.ts"];
  for (const path of changed) {
    const v110 = await readText(join(REVISIONS, "v1.1.0", path));
    const v120 = await readText(join(REVISIONS, "v1.2.0", path));
    assert.notEqual(v110, v120, `${path} must differ between v1.1.0 and v1.2.0`);
  }
  for (const path of added) {
    await assert.rejects(
      readText(join(REVISIONS, "v1.1.0", path)),
      `${path} must not exist in v1.1.0`
    );
    const v120 = await readText(join(REVISIONS, "v1.2.0", path));
    assert.ok(v120.length > 0, `${path} must exist in v1.2.0`);
  }
});

test("Sync state files map to paths that exist in the Derived project", async () => {
  const state = await readJson(join(EXPECTED, "status.json"));
  for (const path of Object.keys(state.files)) {
    const filePath = join(DERIVED, path);
    await assert.doesNotReject(
      readText(filePath),
      `sync-state references missing Derived project file: ${path}`
    );
  }
});

test("Apply plan updates reference paths that exist in either Template revision or Derived project", async () => {
  const plan = await readJson(join(EXPECTED, "apply-plan.json"));
  for (const update of plan.updates) {
    const candidate = [
      join(REVISIONS, "v1.2.0", update.path),
      join(DERIVED, update.path),
    ];
    const found = await Promise.any(
      candidate.map(async (path) => {
        await readText(path);
        return path;
      })
    ).then(
      () => true,
      () => false
    );
    assert.ok(found, `apply update references unknown path: ${update.path}`);
  }
  for (const conflict of plan.conflicts) {
    const candidate = [
      join(REVISIONS, "v1.2.0", conflict.path),
      join(DERIVED, conflict.path),
    ];
    const found = await Promise.any(
      candidate.map(async (path) => {
        await readText(path);
        return path;
      })
    ).then(
      () => true,
      () => false
    );
    assert.ok(found, `apply conflict references unknown path: ${conflict.path}`);
  }
});

test("Promotion metadata candidates and skipped reference Derived project files", async () => {
  const promotion = await readJson(join(EXPECTED, "promotion-metadata.json"));
  for (const candidate of promotion.candidates) {
    await assert.doesNotReject(
      readText(join(DERIVED, candidate.path)),
      `promotion candidate references missing Derived project file: ${candidate.path}`
    );
  }
  for (const skipped of promotion.skipped) {
    await assert.doesNotReject(
      readText(join(DERIVED, skipped.path)),
      `promotion skipped references missing Derived project file: ${skipped.path}`
    );
  }
});

test("Acceptance criteria coverage", async () => {
  const state = await readJson(join(EXPECTED, "status.json"));
  const plan = await readJson(join(EXPECTED, "apply-plan.json"));
  const promotion = await readJson(join(EXPECTED, "promotion-metadata.json"));

  const ownerships = new Set(Object.values(state.files).map((entry) => entry.ownership));
  assert.ok(ownerships.has("template-owned"), "must include a Template-owned case");
  assert.ok(ownerships.has("custom-owned"), "must include a Custom-owned case");
  assert.ok(ownerships.has("mixed"), "must include a Mixed ownership case");

  const checkout = ["apps/checkout/index.ts", "apps/checkout/payment-handler.ts", "apps/checkout/README.md"];
  for (const path of checkout) {
    assert.ok(path in state.files, `${path} must appear in sync-state (Product domain preserved)`);
    assert.equal(state.files[path].ownership, "custom-owned", `${path} must be Custom-owned`);
  }

  const parameters = await readJson(join(DERIVED, ".beztack/parameters.json"));
  assert.ok("appName" in parameters.values, "must include a Template parameter case (appName)");
  const derivedPackage = JSON.parse(await readText(join(DERIVED, "package.json")));
  assert.notEqual(
    derivedPackage.name,
    "{{appName}}",
    "Derived package.json must have rendered Template parameters (no {{...}} placeholders)"
  );

  assert.ok(".env.contract.json" in state.files, "Environment contract must be tracked");
  assert.equal(
    state.files[".env.contract.json"].ownership,
    "template-owned",
    "Environment contract must be Template-owned"
  );
  assert.ok(".env.example" in state.files, "Product example must be tracked");
  assert.equal(
    state.files[".env.example"].ownership,
    "custom-owned",
    "Product example must be Custom-owned"
  );

  assert.ok(
    "pnpm-lock.yaml" in state.files,
    "Lockfile must be tracked (Custom-owned; regenerated locally)"
  );
  assert.equal(
    state.files["pnpm-lock.yaml"].ownership,
    "custom-owned",
    "Lockfile must be Custom-owned"
  );
  assert.ok(
    plan.skipped.some((s) => s.path === "pnpm-lock.yaml"),
    "Apply plan must skip the lockfile (engines regenerate it locally)"
  );

  assert.ok(
    plan.conflicts.some((c) => c.path === "apps/api/middleware.ts"),
    "Sync conflict must be reported, not silently merged"
  );

  assert.ok(
    state.overlaps.some((o) => o.path === "packages/auth/session.ts"),
    "Ownership overlap on packages/auth/session.ts must be detected"
  );

  assert.equal(
    promotion.candidates.length,
    2,
    "Promotion must surface exactly the two Template-owned Promotion candidates"
  );
  assert.ok(
    promotion.skipped.every((s) => s.ownership === "custom-owned" && s.reason === "custom-owned-product-domain"),
    "All Promotion skipped entries must be Custom-owned Product-domain files"
  );
  assert.ok(
    promotion.skipped.some((s) => s.path === "apps/checkout/index.ts"),
    "apps/checkout/index.ts must be skipped from Promotion (Product domain)"
  );
});

test("Template source does not ship a lockfile (regenerated in Derived projects)", async () => {
  for (const revision of ["v1.1.0", "v1.2.0"]) {
    await assert.rejects(
      readText(join(REVISIONS, revision, "pnpm-lock.yaml")),
      `Template source ${revision} must not include pnpm-lock.yaml (lockfiles are regenerated in Derived projects)`
    );
  }
});

test("issue #30: Sync policy, Origin baseline, Sync state, and Sync event log are schema-versioned", async () => {
  for (const [file, path] of [
    ["template.json", join(DERIVED, ".beztack/template.json")],
    ["origin.json", join(DERIVED, ".beztack/origin.json")],
    ["sync-state.json", join(EXPECTED, "status.json")],
    ["sync-event-log.json", join(DERIVED, ".beztack/sync-event-log.json")],
  ]) {
    const value = await readJson(path);
    assert.equal(
      value.schemaVersion,
      "1.0",
      `${file} must declare schemaVersion "1.0"`
    );
  }
});

test("issue #30: Origin baseline orders the Template revision before per-file metadata", async () => {
  const origin = await readJson(join(DERIVED, ".beztack/origin.json"));
  const keys = Object.keys(origin);
  const revIdx = keys.indexOf("templateRevision");
  const refIdx = keys.indexOf("templateRevisionRef");
  const acceptedIdx = keys.indexOf("acceptedAt");
  const filesIdx = keys.indexOf("files");
  assert.ok(revIdx >= 0 && refIdx > revIdx, "templateRevisionRef must follow templateRevision");
  assert.ok(acceptedIdx > refIdx, "acceptedAt must follow templateRevisionRef");
  assert.ok(filesIdx > acceptedIdx, "files (per-file metadata) must follow the Template revision fields");
});

test("issue #30: Sync state and Sync event log are distinct artifacts", async () => {
  const state = await readJson(join(EXPECTED, "status.json"));
  const log = await readJson(join(DERIVED, ".beztack/sync-event-log.json"));
  assert.equal(
    "events" in state,
    false,
    "Sync state must not include an audit-history events array; audit history lives in the Sync event log"
  );
  assert.ok(
    Array.isArray(log.events) && log.events.length > 0,
    "Sync event log must include append-only events"
  );
  for (const evt of log.events) {
    assert.ok(
      typeof evt.eventId === "string" && evt.eventId.length > 0,
      "Each Sync event must have a stable eventId"
    );
    assert.ok(
      typeof evt.timestamp === "string",
      "Each Sync event must have a timestamp"
    );
    assert.ok(
      ["baseline-reset", "apply", "promotion", "schema-rejected"].includes(evt.type),
      `Sync event type ${evt.type} must be one of the documented types`
    );
  }
});

test("issue #30: Sync engine version is recorded separately from Template version", async () => {
  const state = await readJson(join(EXPECTED, "status.json"));
  const plan = await readJson(join(EXPECTED, "apply-plan.json"));
  const log = await readJson(join(DERIVED, ".beztack/sync-event-log.json"));

  for (const [name, obj] of [
    ["sync-state", state],
    ["apply-plan", plan],
  ]) {
    assert.ok(obj.syncEngine, `${name} must include a syncEngine field`);
    assert.ok(typeof obj.syncEngine.name === "string", `${name}.syncEngine.name must be a string`);
    assert.ok(typeof obj.syncEngine.version === "string", `${name}.syncEngine.version must be a string`);
  }

  for (const evt of log.events) {
    assert.ok(evt.syncEngine, `event ${evt.eventId} must include a syncEngine field`);
    assert.ok(
      typeof evt.syncEngine.name === "string" && typeof evt.syncEngine.version === "string",
      `event ${evt.eventId} syncEngine must record name and version`
    );
  }

  const manifest120 = await readJson(join(REVISIONS, "v1.2.0", "template.json"));
  assert.notEqual(
    manifest120.version,
    manifest120.compatibleEngines.minimum,
    "Template version must not equal Sync engine version"
  );
});

test("issue #30: Template versions declare a compatibleEngines range", async () => {
  for (const revision of ["v1.1.0", "v1.2.0"]) {
    const manifest = await readJson(join(REVISIONS, revision, "template.json"));
    assert.equal(manifest.schemaVersion, "1.0", `${revision} manifest must declare schemaVersion "1.0"`);
    assert.ok(
      typeof manifest.compatibleEngines?.minimum === "string",
      `${revision} manifest must declare compatibleEngines.minimum`
    );
    assert.match(
      manifest.compatibleEngines.minimum,
      /^[0-9]+\.[0-9]+\.[0-9]+/,
      `${revision} compatibleEngines.minimum must be semver-shaped`
    );
    if (manifest.compatibleEngines.maximum !== undefined) {
      assert.match(
        manifest.compatibleEngines.maximum,
        /^[0-9]+\.[0-9]+\.[0-9]+/,
        `${revision} compatibleEngines.maximum must be semver-shaped`
      );
    }
  }
});

test("issue #34: Template manifest declares migrations with mode and idempotency", async () => {
  const manifest = await readJson(join(REVISIONS, "v1.2.0/template.json"));
  assert.ok(Array.isArray(manifest.migrations), "v1.2.0 manifest.migrations must be an array");
  assert.ok(manifest.migrations.length >= 3, "fixture must declare at least three migration examples");

  for (const m of manifest.migrations) {
    assert.ok(typeof m.id === "string" && m.id.length > 0, `${JSON.stringify(m)} must have id`);
    assert.ok(["automatic", "manual"].includes(m.mode), `${m.id}.mode must be automatic|manual`);
    assert.ok(typeof m.description === "string" && m.description.length > 0, `${m.id} must have a description`);
    assert.ok(typeof m.idempotency === "object" && m.idempotency !== null, `${m.id} must declare idempotency`);
    assert.ok(typeof m.idempotency.type === "string", `${m.id} idempotency must have a type`);
    assert.ok(
      ["file-exists", "marker-present", "command-succeeds"].includes(m.idempotency.type),
      `${m.id} idempotency.type must be one of the documented variants`
    );
    assert.ok(
      ["any", "trusted"].includes(m.trustClass ?? "any"),
      `${m.id} must declare trustClass (default any)`
    );
  }

  const automatic = manifest.migrations.find((m) => m.mode === "automatic");
  assert.ok(automatic, "fixture must include at least one automatic migration");
  assert.equal(automatic.interactive ?? false, false, "automatic migration in fixture must not be interactive");
  assert.equal(automatic.destructive ?? false, false, "automatic migration in fixture must not be destructive");

  const manual = manifest.migrations.find((m) => m.mode === "manual");
  assert.ok(manual, "fixture must include at least one manual migration");

  const interactive = manifest.migrations.find((m) => m.interactive === true);
  assert.ok(interactive, "fixture must include at least one interactive migration (forced manual)");

  const trustedOnly = manifest.migrations.find((m) => m.trustClass === "trusted");
  assert.ok(trustedOnly, "fixture must include at least one trusted-only migration");
});

test("issue #34: status output surfaces migrations[] and the recommended note mentions them", async () => {
  const state = await readJson(join(EXPECTED, "status.json"));
  const plan = await readJson(join(EXPECTED, "apply-plan.json"));
  assert.ok(Array.isArray(state.migrations) && state.migrations.length > 0, "expected status.json must include migrations[]");
  assert.ok(Array.isArray(plan.migrations) && plan.migrations.length > 0, "expected apply-plan.json must include migrations[]");

  for (const m of state.migrations) {
    assert.ok(["pending", "already-applied"].includes(m.idempotencyStatus), `${m.id} idempotencyStatus must be pending|already-applied`);
    assert.ok(
      ["engine-surfaces-only", "manual-execution-required"].includes(m.execution),
      `${m.id} execution must be engine-surfaces-only|manual-execution-required`
    );
    assert.ok(["any", "trusted"].includes(m.trustClass), `${m.id} trustClass must be any|trusted`);
  }

  const note = state.recommendation.note ?? "";
  assert.ok(/migration/i.test(note), `recommendation.note must mention migrations when any migration is pending (got: ${note})`);
});

test("issue #34: apply plan migrations[] carry idempotency checks and branch actions", async () => {
  const plan = await readJson(join(EXPECTED, "apply-plan.json"));
  assert.ok(Array.isArray(plan.migrations));
  for (const m of plan.migrations) {
    assert.ok(typeof m.id === "string", "plan migration must have id");
    assert.ok(typeof m.idempotency === "object" && typeof m.idempotency.type === "string", `${m.id} plan entry must carry idempotency check`);
    assert.ok(["pending", "already-applied"].includes(m.idempotencyStatus), `${m.id} must declare idempotencyStatus`);
    assert.ok(typeof m.branchAction === "string", `${m.id} must declare branchAction`);
    assert.equal(m.applyOnBranch, true, `${m.id} must be marked applyOnBranch: true (engine surfaces it)`);
  }
});

test("issue #34: migrations declared on the Template manifest are separate from Template-owned file content", async () => {
  const manifest = await readJson(join(REVISIONS, "v1.2.0/template.json"));
  // Migrations must not include `path` fields that overlap with the
  // Template source's file tree (migrations are non-file steps).
  const fileTreePaths = new Set([
    "packages/auth/session.ts",
    "apps/api/routes.ts",
    "apps/api/middleware.ts",
    ".env.contract.json",
    "package.json",
  ]);
  for (const m of manifest.migrations) {
    assert.ok(
      !(m.path && fileTreePaths.has(m.path)),
      `migration ${m.id} must not be expressed as a Template-owned file path`
    );
  }
  // The fixture's expected sync-state.json must not include any migration
  // id as a file key (migrations live in status.migrations[], not in
  // status.files{}).
  const state = await readJson(join(EXPECTED, "status.json"));
  const migrationIds = new Set((manifest.migrations ?? []).map((m) => m.id));
  for (const path of Object.keys(state.files ?? {})) {
    assert.ok(
      !migrationIds.has(path),
      `sync-state.files must not contain migration id ${path} (migrations live in status.migrations[])`
    );
  }
  // The engine must not list any migration id in the apply plan's
  // updates[] / skipped[] / conflicts[] either.
  const plan = await readJson(join(EXPECTED, "apply-plan.json"));
  for (const list of [plan.updates ?? [], plan.skipped ?? [], plan.conflicts ?? []]) {
    for (const entry of list) {
      assert.ok(
        !migrationIds.has(entry.path),
        `apply plan must not classify migration id ${entry.path} as a file update/skip/conflict`
      );
    }
  }
});

test("issue #30: invalid schema versions are rejected by the validator before planning", async () => {
  const policySchema = await readJson(join(SCHEMAS, "sync-policy.schema.json"));
  const stateSchema = await readJson(join(SCHEMAS, "sync-state.schema.json"));
  const logSchema = await readJson(join(SCHEMAS, "sync-event-log.schema.json"));
  const manifestSchema = await readJson(join(SCHEMAS, "template-manifest.schema.json"));

  const validSyncPolicy = await readJson(join(DERIVED, ".beztack/template.json"));
  const validSyncState = await readJson(join(EXPECTED, "status.json"));
  const validSyncEventLog = await readJson(join(DERIVED, ".beztack/sync-event-log.json"));
  const validManifest = await readJson(join(REVISIONS, "v1.2.0", "template.json"));

  const invalidCases = [
    { name: "sync-policy", schema: policySchema, value: { ...validSyncPolicy, schemaVersion: "0.9" } },
    { name: "sync-policy", schema: policySchema, value: { ...validSyncPolicy, schemaVersion: "2.0" } },
    { name: "sync-state", schema: stateSchema, value: { ...validSyncState, schemaVersion: "0.9" } },
    { name: "sync-event-log", schema: logSchema, value: { ...validSyncEventLog, schemaVersion: "2.0" } },
    { name: "template-manifest", schema: manifestSchema, value: { ...validManifest, schemaVersion: "0.5" } },
  ];

  for (const c of invalidCases) {
    const error = validate(c.value, c.schema);
    assert.ok(
      error !== null,
      `validator must reject ${c.name} with schemaVersion ${JSON.stringify(c.value.schemaVersion)}`
    );
    assert.ok(
      error.includes("must equal \"1.0\"") || error.includes('must equal "1.0"'),
      `${c.name} rejection (${c.value.schemaVersion}) must mention the supported schemaVersion 1.0; got: ${error}`
    );
  }
});

test("issue #30: schemas refuse additional properties (locked-down contract)", async () => {
  for (const [name, file] of Object.entries(SCHEMA_FILES)) {
    const schema = await readJson(join(SCHEMAS, file));
    let value;
    if (name === "sync-policy") {
      value = await readJson(join(DERIVED, ".beztack/template.json"));
    } else if (name === "origin-baseline") {
      value = await readJson(join(DERIVED, ".beztack/origin.json"));
    } else if (name === "sync-state") {
      value = await readJson(join(EXPECTED, "status.json"));
    } else if (name === "apply-plan") {
      value = await readJson(join(EXPECTED, "apply-plan.json"));
    } else if (name === "promotion-metadata") {
      value = await readJson(join(EXPECTED, "promotion-metadata.json"));
    } else if (name === "sync-event-log") {
      value = await readJson(join(DERIVED, ".beztack/sync-event-log.json"));
    } else if (name === "template-manifest") {
      value = await readJson(join(REVISIONS, "v1.2.0", "template.json"));
    }
    value = JSON.parse(JSON.stringify(value));
    value.__rogueField = "engines must reject this";
    const error = validate(value, schema);
    assert.ok(
      error !== null && error.includes("__rogueField"),
      `${name} schema must reject unexpected top-level fields`
    );
  }
});

test("README is reachable, non-empty, and references each schema and expected output", async () => {
  const readme = await readText(join(ROOT, "README.md"));
  assert.ok(readme.length > 0, "README must not be empty");
  for (const filename of [
    "sync-policy.schema.json",
    "origin-baseline.schema.json",
    "sync-state.schema.json",
    "apply-plan.schema.json",
    "promotion-metadata.schema.json",
    "sync-event-log.schema.json",
    "template-manifest.schema.json",
    "status.json",
    "apply-plan.json",
    "promotion-metadata.json",
  ]) {
    assert.ok(readme.includes(filename), `README must mention ${filename}`);
  }
});

test("fixture helper: relative paths inside fixture", () => {
  assert.equal(normalize("a/b/c"), "a/b/c");
  assert.equal(relative(ROOT, DERIVED), "derived-project");
});
