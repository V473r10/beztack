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
};

function pathSegments(fileURL) {
  return fileURL.replace(/^file:\/\//, "").split("/").filter(Boolean);
}

function normalize(p) {
  return p.split("/").filter(Boolean).join("/");
}

/**
 * Minimal JSON Schema validator covering the subset used by this fixture:
 * type, const, enum, required, additionalProperties, properties, items,
 * and string format checks (date-time, uri). Errors carry a JSON Pointer.
 */
function compileSchema(schema) {
  function build(node, pointer) {
    const subValidators = {};
    let itemsValidator = null;

    if (node.properties && typeof node.properties === "object") {
      for (const key of Object.keys(node.properties)) {
        subValidators[key] = build(node.properties[key], `${pointer}/${key}`);
      }
    }
    if (node.items && typeof node.items === "object") {
      itemsValidator = build(node.items, `${pointer}/items`);
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

test("README is reachable, non-empty, and references each schema and expected output", async () => {
  const readme = await readText(join(ROOT, "README.md"));
  assert.ok(readme.length > 0, "README must not be empty");
  for (const filename of [
    "sync-policy.schema.json",
    "origin-baseline.schema.json",
    "sync-state.schema.json",
    "apply-plan.schema.json",
    "promotion-metadata.schema.json",
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
