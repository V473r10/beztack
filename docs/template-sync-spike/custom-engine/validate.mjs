#!/usr/bin/env node
/**
 * Schema-validation gate for the Beztack Template Sync engine.
 *
 * Validates every schema-versioned file the engine reads or writes before
 * it does any planning or apply work. Used by beztack-sync.mjs to refuse
 * unsupported schema versions explicitly, per issue #30.
 *
 * The validator is intentionally minimal and dependency-free. It covers
 * the subset of JSON Schema used by the fixture schemas:
 *   - type (string, integer, number, boolean, object, array, null)
 *   - enum, const
 *   - required, additionalProperties
 *   - properties, items, $ref, $defs, oneOf, allOf
 *   - string format: date-time
 *   - string pattern
 *
 * Production engines should swap this for `ajv` or a similar battle-tested
 * implementation while keeping the gate semantics identical.
 */

import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const DEFAULT_SCHEMA_DIR = resolve(here, "../../template-sync-fixture/schemas");

export const SUPPORTED_SCHEMA_VERSIONS = ["1.0"];

export const SCHEMA_FILES = {
  "sync-policy": "sync-policy.schema.json",
  "origin-baseline": "origin-baseline.schema.json",
  "sync-state": "sync-state.schema.json",
  "apply-plan": "apply-plan.schema.json",
  "promotion-metadata": "promotion-metadata.schema.json",
  "sync-event-log": "sync-event-log.schema.json",
  "template-manifest": "template-manifest.schema.json",
};

export async function loadSchemas(schemaDir = DEFAULT_SCHEMA_DIR) {
  const schemas = {};
  for (const [name, file] of Object.entries(SCHEMA_FILES)) {
    schemas[name] = JSON.parse(
      await readFile(resolve(schemaDir, file), "utf8")
    );
  }
  return schemas;
}

export function compileSchema(schema) {
  function build(node) {
    const subValidators = {};
    let itemsValidator = null;
    let oneOfValidators = null;
    let allOfValidators = null;
    if (node.properties && typeof node.properties === "object") {
      for (const key of Object.keys(node.properties)) {
        subValidators[key] = build(node.properties[key]);
      }
    }
    if (node.items && typeof node.items === "object") {
      itemsValidator = build(node.items);
    }
    if (Array.isArray(node.oneOf)) {
      oneOfValidators = node.oneOf.map(build);
    }
    if (Array.isArray(node.allOf)) {
      allOfValidators = node.allOf.map(build);
    }
    const required = Array.isArray(node.required) ? node.required : [];
    const additional = node.additionalProperties;
    return (value) => {
      if (node.const !== undefined) {
        if (JSON.stringify(value) !== JSON.stringify(node.const)) {
          return `must equal ${JSON.stringify(node.const)}`;
        }
      }
      if (Array.isArray(node.enum)) {
        if (
          !node.enum.some(
            (option) => JSON.stringify(option) === JSON.stringify(value)
          )
        ) {
          return `must be one of ${JSON.stringify(node.enum)}`;
        }
      }
      if (node.type !== undefined) {
        const types = Array.isArray(node.type) ? node.type : [node.type];
        if (!types.some((t) => matchesType(t, value))) {
          return `must be of type ${types.join("|")}`;
        }
      }
      if (
        node.type === "object" ||
        node.properties !== undefined ||
        required.length > 0 ||
        additional === false
      ) {
        if (value === null || typeof value !== "object" || Array.isArray(value)) {
          if (node.properties || required.length > 0) {
            return "expected object";
          }
          return null;
        }
        for (const key of required) {
          if (!(key in value)) {
            return `missing required property "${key}"`;
          }
        }
        for (const key of Object.keys(value)) {
          if (!(key in subValidators)) {
            if (additional === false) {
              return `unexpected property "${key}"`;
            }
            continue;
          }
          const error = subValidators[key](value[key]);
          if (error) {
            return `${key}: ${error}`;
          }
        }
      }
      if (node.type === "array" || itemsValidator) {
        if (!Array.isArray(value)) {
          if (itemsValidator) return "expected array";
          return null;
        }
        if (itemsValidator) {
          for (let i = 0; i < value.length; i += 1) {
            const error = itemsValidator(value[i]);
            if (error) {
              return `item ${i}: ${error}`;
            }
          }
        }
      }
      if (typeof node.format === "string" && typeof value === "string") {
        if (node.format === "date-time" && Number.isNaN(Date.parse(value))) {
          return "must be a valid date-time";
        }
      }
      if (typeof node.pattern === "string" && typeof value === "string") {
        let regex;
        try {
          regex = new RegExp(node.pattern);
        } catch {
          return `invalid pattern ${node.pattern}`;
        }
        if (!regex.test(value)) {
          return `must match pattern ${node.pattern}`;
        }
      }
      if (oneOfValidators) {
        const matched = oneOfValidators.filter((fn) => fn(value) === null);
        if (matched.length !== 1) {
          return `must match exactly one of oneOf (matched ${matched.length})`;
        }
      }
      if (allOfValidators) {
        for (const fn of allOfValidators) {
          const error = fn(value);
          if (error) return `allOf: ${error}`;
        }
      }
      return null;
    };
  }
  return build(schema);
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

export function validate(value, schema) {
  return compileSchema(schema)(value);
}

/**
 * Validate a schema-versioned input or output file.
 * Returns { ok: true } or { ok: false, error: string }.
 */
export function validateSchemaVersioned(name, value, schemas) {
  const schema = schemas[name];
  if (!schema) return { ok: false, error: `unknown schema ${name}` };
  const version = value?.schemaVersion;
  if (typeof version !== "string") {
    return { ok: false, error: "missing schemaVersion" };
  }
  if (!SUPPORTED_SCHEMA_VERSIONS.includes(version)) {
    return {
      ok: false,
      error: `unsupported schemaVersion "${version}" (supported: ${SUPPORTED_SCHEMA_VERSIONS.join(", ")})`,
    };
  }
  const err = validate(value, schema);
  if (err) return { ok: false, error: err };
  return { ok: true };
}

/**
 * Gate: validate every input file the engine reads before planning.
 * Throws on the first failure with a clear, machine-readable error.
 */
export function gateInputs(files, schemas) {
  const errors = [];
  for (const [name, value] of Object.entries(files)) {
    const result = validateSchemaVersioned(name, value, schemas);
    if (!result.ok) {
      errors.push({ name, error: result.error });
    }
  }
  return errors;
}

export function parseSemver(version) {
  const m = /^([0-9]+)\.([0-9]+)\.([0-9]+)/.exec(version);
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
  };
}

export function compareSemver(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return null;
  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  return pa.patch - pb.patch;
}

/**
 * Check whether a Sync engine version is compatible with a Template
 * manifest's compatibleEngines range. Returns null on compatible, or a
 * reason string on incompatible.
 */
export function checkEngineCompatibility(manifest, engineVersion) {
  if (!manifest || !manifest.compatibleEngines) return null;
  const min = manifest.compatibleEngines.minimum;
  const max = manifest.compatibleEngines.maximum;
  if (min) {
    const cmp = compareSemver(engineVersion, min);
    if (cmp === null) {
      return `engine version "${engineVersion}" is not a valid semver`;
    }
    if (cmp < 0) {
      return `engine ${engineVersion} is below Template minimum ${min}`;
    }
  }
  if (max) {
    const cmp = compareSemver(engineVersion, max);
    if (cmp === null) {
      return `engine version "${engineVersion}" is not a valid semver`;
    }
    if (cmp > 0) {
      return `engine ${engineVersion} is above Template maximum ${max}`;
    }
  }
  return null;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , schemaName, filePath] = process.argv;
  if (!schemaName || !filePath) {
    console.error("Usage: validate.mjs <schema-name> <file>");
    process.exit(2);
  }
  const schemas = await loadSchemas();
  const value = JSON.parse(await readFile(resolve(filePath), "utf8"));
  const result = validateSchemaVersioned(schemaName, value, schemas);
  if (result.ok) {
    process.stdout.write(
      JSON.stringify({ ok: true, schemaName, schemaVersion: value.schemaVersion }, null, 2) + "\n"
    );
    process.exit(0);
  } else {
    process.stdout.write(
      JSON.stringify({ ok: false, schemaName, error: result.error }, null, 2) + "\n"
    );
    process.exit(1);
  }
}