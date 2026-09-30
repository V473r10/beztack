#!/usr/bin/env node
import { strict as assert } from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
// @ts-check
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const HARNESS = resolve(HERE, "..", "inspect.mjs");
const FIXTURE = resolve(HERE, "..", "fixtures", "legacy-derived");
const TEMPLATE_SOURCE = resolve(HERE, "..", "..", "..");
const HEX_COMMIT_PATTERN = /^[0-9a-f]{7,40}$/;
const MARKDOWN_HEADER_PATTERN =
  /^# beztack-template-sync-inspect — Sync inspection report/m;
const COMPARISON_BASIS_TEXT_PATTERN = /comparison basis/i;
const GUARANTEES_TEXT_PATTERN = /guarantees/i;

function run(args) {
  const r = spawnSync("node", [HARNESS, ...args], {
    encoding: "utf8",
    cwd: HERE,
  });
  return r;
}

function runHarness(args) {
  return run([...args, "--json"]);
}

function requireJson(r) {
  if (r.status === 0) {
    return JSON.parse(r.stdout);
  }
  throw new Error(`harness exited non-zero (${r.status}): ${r.stderr}`);
}

test("harness emits JSON with stable schemaVersion and all guarantees", () => {
  const j = requireJson(runHarness(["--derived", FIXTURE]));
  assert.equal(j.schemaVersion, "1.0");
  assert.equal(j.harness.name, "beztack-template-sync-inspect");
  assert.deepEqual(j.guarantees, {
    readOnly: true,
    didNotMutateDerivedProject: true,
    didNotRewriteOriginBaseline: true,
    didNotInferTemplateRevision: true,
    didNotTreatGenericTagsAsTemplateRevisions: true,
    reportIsNotAnApproval: true,
  });
});

test("harness identifies legacy manifest and hash-only origin as Legacy sync metadata", () => {
  const j = requireJson(runHarness(["--derived", FIXTURE]));
  assert.equal(j.derivedProject.metadata.manifestShape, "legacy");
  assert.equal(j.derivedProject.metadata.originShape, "legacy-hash-only");
  assert.equal(j.derivedProject.metadata.isLegacySyncMetadata, true);
  assert.equal(j.derivedProject.metadata.isHashOnlyOrigin, true);
});

test("harness records comparisonBasis.status=missing when --from/--to are absent", () => {
  const j = requireJson(runHarness(["--derived", FIXTURE]));
  assert.equal(j.comparisonBasis.status, "missing");
  assert.equal(j.comparisonBasis.from.status, "missing");
  assert.equal(j.comparisonBasis.to.status, "missing");
});

test("harness accepts a commit pair and resolves both revisions to explicit refs", () => {
  const j = requireJson(
    runHarness([
      "--derived",
      FIXTURE,
      "--template-source",
      TEMPLATE_SOURCE,
      "--from",
      "HEAD~1",
      "--to",
      "HEAD",
    ])
  );
  assert.equal(j.comparisonBasis.status, "resolved");
  assert.ok(
    j.comparisonBasis.from.status === "exact-commit" ||
      j.comparisonBasis.from.status === "exact-refs",
    `unexpected from status: ${j.comparisonBasis.from.status}`
  );
  assert.ok(
    j.comparisonBasis.to.status === "exact-commit" ||
      j.comparisonBasis.to.status === "exact-refs",
    `unexpected to status: ${j.comparisonBasis.to.status}`
  );
  assert.match(j.comparisonBasis.from.resolvedCommit, HEX_COMMIT_PATTERN);
  assert.match(j.comparisonBasis.to.resolvedCommit, HEX_COMMIT_PATTERN);
});

test("harness rejects a generic CLI tag as a Template revision", () => {
  const j = requireJson(
    runHarness([
      "--derived",
      FIXTURE,
      "--template-source",
      TEMPLATE_SOURCE,
      "--from",
      "v0.1.0",
      "--to",
      "v0.0.8",
    ])
  );
  assert.equal(j.comparisonBasis.from.status, "tag-disallowed");
  assert.equal(j.comparisonBasis.to.status, "tag-disallowed");
  assert.equal(j.comparisonBasis.status, "tag-disallowed");
});

test("harness resolves refs/tags/<name> explicitly to exact-refs", () => {
  const j = requireJson(
    runHarness([
      "--derived",
      FIXTURE,
      "--template-source",
      TEMPLATE_SOURCE,
      "--from",
      "refs/tags/v0.1.0",
      "--to",
      "refs/tags/v0.0.8",
    ])
  );
  assert.equal(j.comparisonBasis.from.status, "exact-refs");
  assert.equal(j.comparisonBasis.to.status, "exact-refs");
});

test("harness emits Filesystem sync seam observation when nitro routes are present", () => {
  const j = requireJson(runHarness(["--derived", FIXTURE]));
  assert.equal(j.ownership.seams.length, 1);
  assert.equal(j.ownership.seams[0].kind, "nitro-fs-routing");
  assert.equal(j.ownership.seams[0].root, "apps/api/server/routes");
});

test("harness classifies files using legacy strategyByPath via Provisional ownership resolution", () => {
  const j = requireJson(runHarness(["--derived", FIXTURE]));
  const menu = j.candidates.find(
    (c) => c.path === "apps/api/server/routes/api/menu/index.ts"
  );
  assert.ok(menu, "menu file should appear in candidates");
  assert.equal(menu.ownership.strategy, "custom-owned");
  assert.equal(menu.ownership.confidence, "specific-match");
  assert.equal(menu.category, "custom-owned-product-domain");
  const pkg = j.candidates.find(
    (c) => c.path === "packages/sync-owned/README.ts"
  );
  assert.ok(pkg, "package file should appear in candidates");
  assert.equal(pkg.ownership.strategy, "mixed");
});

test("harness emits a Markdown derivative, not a separate format", () => {
  const r = run(["--derived", FIXTURE, "--markdown"]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, MARKDOWN_HEADER_PATTERN);
  assert.match(r.stdout, COMPARISON_BASIS_TEXT_PATTERN);
  assert.match(r.stdout, GUARANTEES_TEXT_PATTERN);
});

test("harness refuses to run without --derived", () => {
  const r = run([]);
  assert.notEqual(r.status, 0);
});
