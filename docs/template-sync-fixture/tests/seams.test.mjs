/**
 * Sync seams for lncd wiring drift — issue #35.
 *
 * Validates that the Sync engine contract fixture models the issue #35
 * design:
 *
 *   - Two Sync seams on `apps/api/routes.ts`
 *     (`api-route-registration` for platform routes,
 *     `product-route-registration` for Product domain routes). Both seams
 *     are preserved verbatim by the engine during a Template update.
 *   - One new Template-owned file `apps/api/products.ts` with the
 *     `product-module-registration` Sync seam. Derived projects register
 *     Product domain modules (request-time logic, feature flags, audits)
 *     through this seam without editing Template-owned wiring directly.
 *   - The existing conflict at `apps/api/middleware.ts` (Mixed without a
 *     seam) is preserved as the negative case that motivates the new
 *     seams. The right fix is to register a seam, NOT to mark the file
 *     Custom-owned to hide the drift.
 *
 * Runs with Node's built-in test runner (no external dependencies):
 *   node --test docs/template-sync-fixture/tests/seams.test.mjs
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

test("issue #35: Sync policy declares the new Sync seams for routing and module wiring", async () => {
  const policy = await readJson(join(ROOT, "derived-project/.beztack/template.json"));
  const seamIds = (policy.seams ?? []).map((s) => s.id).sort();
  assert.ok(
    seamIds.includes("api-route-registration"),
    "policy must keep the api-route-registration seam (issue #31)"
  );
  assert.ok(
    seamIds.includes("product-route-registration"),
    "policy must declare the product-route-registration seam (issue #35)"
  );
  assert.ok(
    seamIds.includes("product-module-registration"),
    "policy must declare the product-module-registration seam (issue #35)"
  );
});

test("issue #35: product-route-registration seam is on apps/api/routes.ts", async () => {
  const policy = await readJson(join(ROOT, "derived-project/.beztack/template.json"));
  const productRoute = (policy.seams ?? []).find(
    (s) => s.id === "product-route-registration"
  );
  assert.ok(productRoute, "policy must include the product-route-registration seam");
  assert.equal(
    productRoute.file,
    "apps/api/routes.ts",
    "product-route-registration must be declared on apps/api/routes.ts"
  );
  assert.ok(
    productRoute.marker && productRoute.marker.includes("product-route-registration"),
    "seam marker must identify the product-route-registration region"
  );
});

test("issue #35: product-module-registration seam is on a new Template-owned file apps/api/products.ts", async () => {
  const policy = await readJson(join(ROOT, "derived-project/.beztack/template.json"));
  const productModule = (policy.seams ?? []).find(
    (s) => s.id === "product-module-registration"
  );
  assert.ok(productModule, "policy must include the product-module-registration seam");
  assert.equal(
    productModule.file,
    "apps/api/products.ts",
    "product-module-registration must be declared on apps/api/products.ts"
  );

  const productsRule = (policy.ownership ?? []).find(
    (r) => r.path === "apps/api/products.ts"
  );
  assert.ok(productsRule, "policy must declare ownership for apps/api/products.ts");
  assert.equal(
    productsRule.strategy,
    "mixed",
    "apps/api/products.ts must be Mixed ownership so the seam can preserve the Derived project's module registrations"
  );
});

test("issue #35: Template v1.1.0 ships apps/api/products.ts with the product-module-registration seam", async () => {
  const products = await readFile(
    join(ROOT, "template-revisions/v1.1.0/apps/api/products.ts"),
    "utf8"
  );
  assert.match(
    products,
    /registerProductModule/,
    "v1.1.0 products.ts must expose the registerProductModule API"
  );
  assert.match(
    products,
    /Sync seam: product-module-registration/,
    "v1.1.0 products.ts must document the product-module-registration seam (JSDoc)"
  );
});

test("issue #35: Template v1.1.0 ships the product-route-registration seam in apps/api/routes.ts", async () => {
  const routes = await readFile(
    join(ROOT, "template-revisions/v1.1.0/apps/api/routes.ts"),
    "utf8"
  );
  assert.match(
    routes,
    /Sync seam: product-route-registration/,
    "v1.1.0 routes.ts must document the product-route-registration seam (JSDoc)"
  );
  assert.match(
    routes,
    /Sync seam: api-route-registration/,
    "v1.1.0 routes.ts must keep the api-route-registration seam documented (JSDoc)"
  );
  assert.match(
    routes,
    /registerProductRoute/,
    "v1.1.0 routes.ts must expose the registerProductRoute API"
  );
});

test("issue #35: Template v1.2.0 preserves both routing seams and the product-module seam", async () => {
  const routes = await readFile(
    join(ROOT, "template-revisions/v1.2.0/apps/api/routes.ts"),
    "utf8"
  );
  assert.match(
    routes,
    /Sync seam: product-route-registration/,
    "v1.2.0 routes.ts must keep the product-route-registration seam documented"
  );
  assert.match(
    routes,
    /Sync seam: api-route-registration/,
    "v1.2.0 routes.ts must keep the api-route-registration seam documented"
  );
  assert.match(
    routes,
    /__templateVersion = "1\.2\.0"/,
    "v1.2.0 routes.ts must declare the new harness version"
  );

  const products = await readFile(
    join(ROOT, "template-revisions/v1.2.0/apps/api/products.ts"),
    "utf8"
  );
  assert.match(
    products,
    /Sync seam: product-module-registration/,
    "v1.2.0 products.ts must keep the product-module-registration seam documented"
  );
  assert.match(
    products,
    /__templateVersion = "1\.2\.0"/,
    "v1.2.0 products.ts must declare the new harness version"
  );
});

test("issue #35: Derived project registers Product routes through the product-route-registration seam", async () => {
  const derived = await readFile(
    join(ROOT, "derived-project/apps/api/routes.ts"),
    "utf8"
  );
  assert.match(
    derived,
    /registerProductRoute\("\/api\/checkout\/start"/,
    "Derived project's product-route-registration seam must register /api/checkout/start"
  );
  assert.match(
    derived,
    /registerProductRoute\("\/api\/checkout\/complete"/,
    "Derived project's product-route-registration seam must register /api/checkout/complete"
  );
  assert.match(
    derived,
    /product-route-registration seam — DO NOT EDIT FROM TEMPLATE SOURCE/,
    "Derived project's product-route-registration seam region must be clearly marked"
  );
});

test("issue #35: Derived project registers Product modules through the product-module-registration seam", async () => {
  const derived = await readFile(
    join(ROOT, "derived-project/apps/api/products.ts"),
    "utf8"
  );
  assert.match(
    derived,
    /registerProductModule\(\(_req, _res, next\) => \{/,
    "Derived project must register at least one module through the seam"
  );
  assert.match(
    derived,
    /product-module-registration seam — DO NOT EDIT FROM TEMPLATE SOURCE/,
    "Derived project's product-module-registration seam region must be clearly marked"
  );
});

test("issue #35: conflict case apps/api/middleware.ts remains Mixed without a seam", async () => {
  const policy = await readJson(join(ROOT, "derived-project/.beztack/template.json"));
  const middlewareSeams = (policy.seams ?? []).filter(
    (s) => s.file === "apps/api/middleware.ts"
  );
  assert.equal(
    middlewareSeams.length,
    0,
    "apps/api/middleware.ts must NOT register a seam — it remains the negative case that motivates issue #35"
  );
  const middlewareRule = (policy.ownership ?? []).find(
    (r) => r.path === "apps/api/middleware.ts"
  );
  assert.ok(middlewareRule, "apps/api/middleware.ts must declare ownership");
  assert.notEqual(
    middlewareRule.strategy,
    "custom-owned",
    "apps/api/middleware.ts must NOT be Custom-owned (issue #35 says the drift must not be hidden)"
  );
  assert.equal(
    middlewareRule.strategy,
    "mixed",
    "apps/api/middleware.ts must stay Mixed so the engine surfaces the conflict as a missing-seam case"
  );
});

test("issue #35: Origin baseline tracks both routing seams and the new module file", async () => {
  const origin = await readJson(join(ROOT, "derived-project/.beztack/origin.json"));
  assert.ok(
    "apps/api/routes.ts" in origin.files,
    "origin.json must track apps/api/routes.ts (api-route-registration + product-route-registration seams)"
  );
  assert.ok(
    "apps/api/products.ts" in origin.files,
    "origin.json must track apps/api/products.ts (product-module-registration seam)"
  );
});

test("issue #35: expected status.json surfaces both routing seams and the product-module seam", async () => {
  const status = await readJson(join(ROOT, "expected/status.json"));
  const routes = status.files["apps/api/routes.ts"];
  assert.ok(routes, "status must include apps/api/routes.ts");
  assert.ok(
    Array.isArray(routes.seams) && routes.seams.length === 2,
    "apps/api/routes.ts must report two seams (api-route-registration + product-route-registration)"
  );
  assert.ok(
    routes.seams.includes("api-route-registration"),
    "seams[] must include api-route-registration"
  );
  assert.ok(
    routes.seams.includes("product-route-registration"),
    "seams[] must include product-route-registration (issue #35)"
  );
  assert.equal(
    routes.seam,
    "api-route-registration",
    "primary seam field must mirror the first seam id"
  );

  const products = status.files["apps/api/products.ts"];
  assert.ok(products, "status must include apps/api/products.ts (issue #35)");
  assert.equal(
    products.seam,
    "product-module-registration",
    "apps/api/products.ts primary seam must be product-module-registration"
  );
  assert.deepEqual(
    products.seams,
    ["product-module-registration"],
    "apps/api/products.ts seams[] must list only product-module-registration"
  );
});

test("issue #35: expected apply-plan.json preserves the multiple-seam contract", async () => {
  const plan = await readJson(join(ROOT, "expected/apply-plan.json"));
  const routesUpdate = plan.updates.find((u) => u.path === "apps/api/routes.ts");
  assert.ok(routesUpdate, "apply plan must update apps/api/routes.ts");
  assert.equal(
    routesUpdate.reason,
    "template-harness-updated-seams-preserved",
    "apply plan must record the multi-seam preservation reason (issue #35)"
  );
  assert.deepEqual(
    routesUpdate.seams,
    ["api-route-registration", "product-route-registration"],
    "apply plan must list both seams for apps/api/routes.ts"
  );
  assert.equal(
    routesUpdate.seam,
    "api-route-registration",
    "primary seam field must mirror the first seam id"
  );

  const productsUpdate = plan.updates.find((u) => u.path === "apps/api/products.ts");
  assert.ok(productsUpdate, "apply plan must update apps/api/products.ts");
  assert.equal(
    productsUpdate.seam,
    "product-module-registration",
    "apps/api/products.ts apply plan entry must record product-module-registration as the primary seam"
  );
  assert.deepEqual(
    productsUpdate.seams,
    ["product-module-registration"],
    "apps/api/products.ts apply plan entry must list product-module-registration"
  );

  assert.match(
    plan.summary,
    /api-route-registration/,
    "apply plan summary must mention api-route-registration"
  );
  assert.match(
    plan.summary,
    /product-route-registration/,
    "apply plan summary must mention product-route-registration (issue #35)"
  );
  assert.match(
    plan.summary,
    /product-module-registration/,
    "apply plan summary must mention product-module-registration (issue #35)"
  );
});

test("issue #35: expected status.json keeps the apps/api/middleware.ts conflict as the negative case", async () => {
  const status = await readJson(join(ROOT, "expected/status.json"));
  const middleware = status.conflicts.find(
    (c) => c.path === "apps/api/middleware.ts"
  );
  assert.ok(middleware, "expected status must keep the middleware.ts conflict");
  assert.equal(middleware.reason, "both-changed-no-seam");
  assert.match(
    middleware.detail,
    /apps\/api\/products\.ts/,
    "conflict detail must reference the new product-module-registration seam as the right fix"
  );
  assert.match(
    status.recommendation.note,
    /api-route-registration/,
    "recommendation note must mention the api-route-registration seam"
  );
  assert.match(
    status.recommendation.note,
    /product-route-registration/,
    "recommendation note must mention the product-route-registration seam (issue #35)"
  );
  assert.match(
    status.recommendation.note,
    /product-module-registration/,
    "recommendation note must mention the product-module-registration seam (issue #35)"
  );
});

test("issue #35: schemas accept the seams[] field on sync-state and apply-plan entries", async () => {
  const stateSchema = await readJson(join(ROOT, "schemas/sync-state.schema.json"));
  const planSchema = await readJson(join(ROOT, "schemas/apply-plan.schema.json"));

  const fileEntrySchema = stateSchema.properties.files.additionalProperties;
  assert.ok(
    fileEntrySchema.properties.seams,
    "sync-state schema must allow a seams[] array on each file entry (issue #35)"
  );
  assert.equal(
    fileEntrySchema.properties.seams.type,
    "array",
    "sync-state schema seams[] must be an array"
  );

  const updateSchema = planSchema.properties.updates.items;
  assert.ok(
    updateSchema.properties.seams,
    "apply-plan schema must allow a seams[] array on each update entry (issue #35)"
  );
  assert.equal(
    updateSchema.properties.seams.type,
    "array",
    "apply-plan schema seams[] must be an array"
  );
});