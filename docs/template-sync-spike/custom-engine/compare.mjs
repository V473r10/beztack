#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = process.argv[2] ?? resolve(here, "../fixture");
const execFile = promisify(execFileCb);

async function getEngineJson(subcommand, planFlag = false) {
  const args = [
    resolve(here, "beztack-sync.mjs"),
    subcommand,
    "--fixture",
    fixtureRoot,
    "--engine",
    "beztack-sync-prototype",
    "0.2.0",
    "--trust-class",
    "trusted",
  ];
  if (planFlag) args.push("--plan");
  if (subcommand === "promotion-metadata") {
    args.push(
      "--label",
      "promotion: candidate",
      "--source-pr",
      "https://github.com/example/derived-app/pull/42"
    );
  }
  const { stdout } = await execFile("node", args);
  return JSON.parse(stdout);
}

function makeValidator(schema) {
  function walk(sub, value, path) {
    if (sub === true) return [];
    if (sub === false) return [{ path, message: "schema disallows" }];
    const errors = [];
    if (sub.const !== undefined && value !== sub.const) {
      errors.push({ path, message: `expected const ${sub.const}, got ${value}` });
    }
    if (sub.enum && !sub.enum.includes(value)) {
      errors.push({ path, message: `expected one of ${JSON.stringify(sub.enum)}, got ${value}` });
    }
    if (sub.type === "object" || sub.properties || sub.required || sub.additionalProperties === false) {
      if (value === null || typeof value !== "object" || Array.isArray(value)) {
        if (sub.properties || sub.required) {
          errors.push({ path, message: "expected object" });
          return errors;
        }
      } else {
        if (sub.required) {
          for (const key of sub.required) {
            if (!(key in value)) errors.push({ path: `${path}.${key}`, message: "missing required" });
          }
        }
        if (sub.properties) {
          for (const [key, sub2] of Object.entries(sub.properties)) {
            if (key in value) errors.push(...walk(sub2, value[key], `${path}.${key}`));
          }
        }
        if (sub.additionalProperties === false && sub.properties) {
          for (const key of Object.keys(value)) {
            if (!(key in sub.properties)) errors.push({ path: `${path}.${key}`, message: "additional property not allowed" });
          }
        }
      }
    }
    if (sub.type === "array" || sub.items) {
      if (!Array.isArray(value)) {
        if (sub.items) errors.push({ path, message: "expected array" });
      } else if (sub.items) {
        for (let i = 0; i < value.length; i++) {
          errors.push(...walk(sub.items, value[i], `${path}[${i}]`));
        }
      }
    }
    return errors;
  }
  return (value, path = "$") => walk(schema, value, path);
}

const out = {
  schemaVersion: "1.0",
  generated: new Date().toISOString(),
  fixture: fixtureRoot,
  results: {},
};

const schemas = {
  "sync-state": JSON.parse(
    await readFile(resolve(fixtureRoot, "schemas/sync-state.schema.json"), "utf8")
  ),
  "apply-plan": JSON.parse(
    await readFile(resolve(fixtureRoot, "schemas/apply-plan.schema.json"), "utf8")
  ),
  "promotion-metadata": JSON.parse(
    await readFile(resolve(fixtureRoot, "schemas/promotion-metadata.schema.json"), "utf8")
  ),
};

const statusExpected = JSON.parse(
  await readFile(resolve(fixtureRoot, "expected/status.json"), "utf8")
);
const planExpected = JSON.parse(
  await readFile(resolve(fixtureRoot, "expected/apply-plan.json"), "utf8")
);
const promoExpected = JSON.parse(
  await readFile(
    resolve(fixtureRoot, "expected/promotion-metadata.json"),
    "utf8"
  )
);

const validateSyncState = makeValidator(schemas["sync-state"]);
const validateApplyPlan = makeValidator(schemas["apply-plan"]);
const validatePromotionMetadata = makeValidator(schemas["promotion-metadata"]);

const status = await getEngineJson("status");
out.results.status = {
  schemaErrors: validateSyncState(status),
  checks: {
    statusValue: status.status === statusExpected.status,
    conflictCount: status.conflicts.length === statusExpected.conflicts.length,
    conflictPaths:
      status.conflicts.map((c) => c.path).sort().join(",") ===
      statusExpected.conflicts.map((c) => c.path).sort().join(","),
    overlapPathCount:
      status.overlaps.length >= statusExpected.overlaps.length,
    overlapExpectedPathsPresent: statusExpected.overlaps.every((o) =>
      status.overlaps.some((s) => s.path === o.path)
    ),
    recommendationAction:
      status.recommendation.action === statusExpected.recommendation.action,
    syncEnginePresent:
      !!status.syncEngine &&
      !!status.syncEngine.name &&
      !!status.syncEngine.version,
    schemaVersionCorrect: status.schemaVersion === "1.0",
    migrationsPresent:
      Array.isArray(status.migrations) &&
      status.migrations.length === statusExpected.migrations.length,
    migrationsMatchExpected:
      statusExpected.migrations.every((expected) =>
        status.migrations.some(
          (s) =>
            s.id === expected.id &&
            s.idempotencyStatus === expected.idempotencyStatus &&
            s.execution === expected.execution &&
            s.trustClass === expected.trustClass &&
            s.action === expected.action
        )
      ),
    trustBlockPresent:
      !!status.trust &&
      typeof status.trust.trustClass === "string" &&
      typeof status.trust.source === "string" &&
      typeof status.trust.registryId === "string" &&
      typeof status.trust.registryVersion === "string" &&
      typeof status.trust.effectiveTrustClass === "string" &&
      typeof status.trust.trustOverriddenByCaller === "boolean",
    trustClassMatchesRegistry:
      status.trust?.trustClass === statusExpected.trust?.trustClass,
    trustSourceMatchesRegistry:
      status.trust?.source === statusExpected.trust?.source,
    trustRepositoryKnownUrlsPreserved: Array.isArray(
      status.trust?.repository?.knownUrls
    ),
  },
};

const plan = await getEngineJson("apply", true);
out.results.applyPlan = {
  schemaErrors: validateApplyPlan(plan),
  checks: {
    branchIsNotMain: plan.branch !== "main" && plan.branch !== "master",
    branchFollowsConvention:
      plan.branch ===
      `template-sync/${planExpected.fromRevision}-to-${planExpected.toRevision}`,
    updatesContainExpectedPaths: planExpected.updates.every((u) =>
      plan.updates.some((p) => p.path === u.path)
    ),
    skippedContainsExpectedPaths: planExpected.skipped.every((s) =>
      plan.skipped.some((p) => p.path === s.path)
    ),
    conflictPathPresent: planExpected.conflicts.every((c) =>
      plan.conflicts.some((p) => p.path === c.path)
    ),
    blockersEmpty: plan.blockers.length === 0,
    schemaVersionCorrect: plan.schemaVersion === "1.0",
    migrationsPresent:
      Array.isArray(plan.migrations) &&
      plan.migrations.length === planExpected.migrations.length,
    migrationsMatchExpected:
      planExpected.migrations.every((expected) =>
        plan.migrations.some(
          (m) =>
            m.id === expected.id &&
            m.idempotencyStatus === expected.idempotencyStatus &&
            m.execution === expected.execution &&
            m.trustClass === expected.trustClass &&
            m.branchAction === expected.branchAction
        )
      ),
    trustBlockPresent:
      !!plan.trust &&
      typeof plan.trust.trustClass === "string" &&
      typeof plan.trust.source === "string",
  },
};

const promo = await getEngineJson("promotion-metadata");
out.results.promotionMetadata = {
  schemaErrors: validatePromotionMetadata(promo),
  checks: {
    candidatesExact:
      JSON.stringify(promo.candidates.map((c) => c.path).sort()) ===
      JSON.stringify(promoExpected.candidates.map((c) => c.path).sort()),
    expectedCandidatesPresent: promoExpected.candidates.every((c) =>
      promo.candidates.some((p) => p.path === c.path)
    ),
    expectedSkippedSubsetOfSkipped: promoExpected.skipped.every((s) =>
      promo.skipped.some((p) => p.path === s.path)
    ),
    trustClassCorrect: promo.trustClass === promoExpected.trustClass,
    trustBlockPresent:
      !!promo.trust &&
      promo.trust.trustClass === promo.trustClass &&
      typeof promo.trust.source === "string",
    labelCorrect: promo.label === promoExpected.label,
    baselineRevisionCorrect:
      promo.baselineRevision === promoExpected.baselineRevision,
    schemaVersionCorrect: promo.schemaVersion === "1.0",
    syncEngineRecorded:
      !!promo.syncEngine &&
      typeof promo.syncEngine.name === "string" &&
      typeof promo.syncEngine.version === "string",
    checksRecorded:
      promo.checks.length === promoExpected.checks.length,
    entryModeRecorded:
      typeof promo.entryMode === "string" &&
      ["normal-pr", "patch", "trusted-automation"].includes(promo.entryMode),
    sourcePRsRecorded:
      Array.isArray(promo.sourcePRs) &&
      promo.sourcePRs.length >= 1 &&
      promo.sourcePR === promo.sourcePRs[0],
    engineChecksTagged:
      promo.checks.every((c) => typeof c.source === "string"),
  },
};

const allPass =
  out.results.status.schemaErrors.length === 0 &&
  Object.values(out.results.status.checks).every(Boolean) &&
  out.results.applyPlan.schemaErrors.length === 0 &&
  Object.values(out.results.applyPlan.checks).every(Boolean) &&
  out.results.promotionMetadata.schemaErrors.length === 0 &&
  Object.values(out.results.promotionMetadata.checks).every(Boolean);

out.allPass = allPass;

process.stdout.write(JSON.stringify(out, null, 2) + "\n");
process.exit(allPass ? 0 : 1);
