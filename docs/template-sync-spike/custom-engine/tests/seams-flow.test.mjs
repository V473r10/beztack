/**
 * Engine tests for Sync seams (issue #35).
 *
 * Validates that the custom Sync engine prototype (issue #28) honors the
 * new Sync seams added in issue #35:
 *
 *   - `product-route-registration` seam on `apps/api/routes.ts`
 *     (preserves `registerProductRoute(...)` calls alongside the
 *     existing `api-route-registration` seam).
 *   - `product-module-registration` seam on `apps/api/products.ts`
 *     (preserves `registerProductModule(...)` calls).
 *   - The engine surfaces both seams via `status.files[].seams` and
 *     `apply-plan.updates[].seams`.
 *   - The `apply --worktree` branch preserves every seam region
 *     verbatim while still applying the v1.2.0 harness.
 *
 * Runs with Node's built-in test runner (no external dependencies):
 *   node --test docs/template-sync-spike/custom-engine/tests/seams-flow.test.mjs
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile as execFileCb } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const execFile = promisify(execFileCb);
const here = dirname(fileURLToPath(import.meta.url));
const ENGINE_DIR = resolve(here, "..");
const REPO_ROOT = resolve(ENGINE_DIR, "../../..");
const FIXTURE = join(REPO_ROOT, "docs/template-sync-fixture");
const ENGINE = join(ENGINE_DIR, "beztack-sync.mjs");

const WORK_ROOT = "/tmp/opencode/beztack-seams-test";

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

async function readText(path) {
  return readFile(path, "utf8");
}

test("issue #35: status JSON surfaces seams[] on apps/api/routes.ts", async () => {
  const { json: status } = await runEngineJson([
    "status",
    "--fixture",
    FIXTURE,
  ]);
  const routes = status.files["apps/api/routes.ts"];
  assert.ok(routes, "status must include apps/api/routes.ts");
  assert.ok(
    Array.isArray(routes.seams) && routes.seams.length === 2,
    "apps/api/routes.ts must report exactly two seams (issue #35)"
  );
  assert.deepEqual(
    routes.seams.slice().sort(),
    ["api-route-registration", "product-route-registration"],
    "apps/api/routes.ts seams[] must list both routing seams (issue #35)"
  );
  assert.equal(
    routes.seam,
    "api-route-registration",
    "primary seam field must mirror the first seam id"
  );
});

test("issue #35: status JSON surfaces the product-module-registration seam on apps/api/products.ts", async () => {
  const { json: status } = await runEngineJson([
    "status",
    "--fixture",
    FIXTURE,
  ]);
  const products = status.files["apps/api/products.ts"];
  assert.ok(products, "status must include apps/api/products.ts");
  assert.equal(
    products.ownership,
    "mixed",
    "apps/api/products.ts must be Mixed ownership (issue #35)"
  );
  assert.equal(
    products.seam,
    "product-module-registration",
    "apps/api/products.ts primary seam must be product-module-registration (issue #35)"
  );
  assert.deepEqual(
    products.seams,
    ["product-module-registration"],
    "apps/api/products.ts seams[] must list product-module-registration (issue #35)"
  );
});

test("issue #35: apply plan surfaces both routing seams and the product-module seam", async () => {
  const { json: envelope } = await runEngineJson([
    "apply",
    "--plan",
    "--fixture",
    FIXTURE,
  ]);
  const plan = envelope.plan ?? envelope;

  const routesUpdate = plan.updates.find((u) => u.path === "apps/api/routes.ts");
  assert.ok(routesUpdate, "apply plan must update apps/api/routes.ts");
  assert.deepEqual(
    routesUpdate.seams.slice().sort(),
    ["api-route-registration", "product-route-registration"],
    "apply plan must list both routing seams on apps/api/routes.ts (issue #35)"
  );
  assert.equal(
    routesUpdate.reason,
    "template-harness-updated-seams-preserved",
    "apply plan reason must reflect multi-seam preservation (issue #35)"
  );

  const productsUpdate = plan.updates.find(
    (u) => u.path === "apps/api/products.ts"
  );
  assert.ok(productsUpdate, "apply plan must update apps/api/products.ts");
  assert.deepEqual(
    productsUpdate.seams,
    ["product-module-registration"],
    "apply plan must list product-module-registration (issue #35)"
  );

  assert.match(
    plan.summary,
    /api-route-registration.*product-route-registration|api-route-registration \+ product-route-registration/,
    "apply plan summary must mention both routing seams (issue #35)"
  );
  assert.match(
    plan.summary,
    /product-module-registration/,
    "apply plan summary must mention the product-module-registration seam (issue #35)"
  );
});

test("issue #35: apply --worktree preserves both routing seams and the product-module seam in the branch", async () => {
  await mkdir(WORK_ROOT, { recursive: true });
  const worktree = join(WORK_ROOT, "branch");
  await rm(worktree, { recursive: true, force: true });

  const { json: envelope } = await runEngineJson([
    "apply",
    "--worktree",
    worktree,
    "--fixture",
    FIXTURE,
  ]);

  // apps/api/routes.ts: v1.2.0 harness + both seam regions preserved.
  const routes = await readText(join(worktree, "apps/api/routes.ts"));
  assert.match(
    routes,
    /__templateVersion = "1\.2\.0"/,
    "routes.ts must use the v1.2.0 harness"
  );
  assert.match(
    routes,
    /productRouteCount/,
    "routes.ts must include the v1.2.0-only productRouteCount() function"
  );
  assert.match(
    routes,
    /registerRoute\("\/health"/,
    "api-route-registration seam must preserve the Derived project's /health route"
  );
  assert.match(
    routes,
    /registerRoute\("\/api\/products\/:id"/,
    "api-route-registration seam must preserve the Derived project's /api/products/:id route"
  );
  assert.match(
    routes,
    /registerProductRoute\("\/api\/checkout\/start"/,
    "product-route-registration seam must preserve /api/checkout/start"
  );
  assert.match(
    routes,
    /registerProductRoute\("\/api\/checkout\/complete"/,
    "product-route-registration seam must preserve /api/checkout/complete"
  );

  // apps/api/products.ts: v1.2.0 harness + product-module-registration seam
  // preserved.
  const products = await readText(join(worktree, "apps/api/products.ts"));
  assert.match(
    products,
    /__templateVersion = "1\.2\.0"/,
    "products.ts must use the v1.2.0 harness"
  );
  assert.match(
    products,
    /moduleCount/,
    "products.ts must include the v1.2.0-only moduleCount() function"
  );
  assert.match(
    products,
    /registerProductModule\(\(_req, _res, next\) => \{/,
    "product-module-registration seam must preserve the Derived project's first module"
  );
  assert.match(
    products,
    /registerProductModule\(\(req, _res, next\) => \{/,
    "product-module-registration seam must preserve the Derived project's second module"
  );

  // Result must report each preserved seam explicitly.
  const result = envelope.result;
  assert.ok(
    Array.isArray(result.seamsPreserved) &&
      result.seamsPreserved.some((entry) =>
        entry.includes("api-route-registration")
      ) &&
      result.seamsPreserved.some((entry) =>
        entry.includes("product-route-registration")
      ) &&
      result.seamsPreserved.some((entry) =>
        entry.includes("product-module-registration")
      ),
    "engine must report that all three seams were preserved"
  );
});

test("issue #35: human-readable BRANCH_README lists every preserved seam", async () => {
  await mkdir(WORK_ROOT, { recursive: true });
  const worktree = join(WORK_ROOT, "readme");
  await rm(worktree, { recursive: true, force: true });

  await runEngineJson(["apply", "--worktree", worktree, "--fixture", FIXTURE]);

  const readme = await readText(join(worktree, "BRANCH_README.md"));
  assert.match(
    readme,
    /api-route-registration/,
    "BRANCH_README must mention the api-route-registration seam"
  );
  assert.match(
    readme,
    /product-route-registration/,
    "BRANCH_README must mention the product-route-registration seam (issue #35)"
  );
  assert.match(
    readme,
    /product-module-registration/,
    "BRANCH_README must mention the product-module-registration seam (issue #35)"
  );
  assert.match(
    readme,
    /Sync seams preserved/,
    "BRANCH_README must include a 'Sync seams preserved' section"
  );
});

test("issue #35: status human view shows the multiple seams per file", async () => {
  const { stdout } = await runEngine([
    "status",
    "--fixture",
    FIXTURE,
    "--format",
    "human",
  ]);
  assert.match(stdout, /Seam\(s\)/, "human view must show the multi-seam column");
  assert.match(
    stdout,
    /apps\/api\/routes\.ts.*api-route-registration.*product-route-registration/s,
    "human view must list both routing seams on apps/api/routes.ts"
  );
  assert.match(
    stdout,
    /apps\/api\/products\.ts.*product-module-registration/s,
    "human view must list the product-module-registration seam on apps/api/products.ts"
  );
});

test("issue #35: apps/api/middleware.ts stays a conflict (negative case)", async () => {
  const { json: status } = await runEngineJson([
    "status",
    "--fixture",
    FIXTURE,
  ]);
  const middleware = status.files["apps/api/middleware.ts"];
  assert.ok(middleware, "status must include apps/api/middleware.ts");
  assert.equal(
    middleware.ownership,
    "mixed",
    "apps/api/middleware.ts must stay Mixed so the conflict is visible (issue #35)"
  );
  assert.ok(
    Array.isArray(middleware.seams) && middleware.seams.length === 0,
    "apps/api/middleware.ts must declare no seams — that is the issue #35 negative case"
  );
  const middlewareConflict = status.conflicts.find(
    (c) => c.path === "apps/api/middleware.ts"
  );
  assert.ok(
    middlewareConflict,
    "apps/api/middleware.ts must remain in status.conflicts (negative case)"
  );
  assert.equal(middlewareConflict.reason, "both-changed-no-seam");
});

test("issue #35: applied worktree writes seams[] into the updated sync-state.json", async () => {
  await mkdir(WORK_ROOT, { recursive: true });
  const worktree = join(WORK_ROOT, "state");
  await rm(worktree, { recursive: true, force: true });

  await runEngineJson(["apply", "--worktree", worktree, "--fixture", FIXTURE]);

  const state = JSON.parse(
    await readText(join(worktree, ".beztack/sync-state.json"))
  );
  const routes = state.files["apps/api/routes.ts"];
  const products = state.files["apps/api/products.ts"];
  assert.ok(routes, "worktree sync-state must include apps/api/routes.ts");
  assert.deepEqual(
    routes.seams.slice().sort(),
    ["api-route-registration", "product-route-registration"],
    "worktree sync-state must list both routing seams on apps/api/routes.ts"
  );
  assert.deepEqual(
    products.seams,
    ["product-module-registration"],
    "worktree sync-state must list product-module-registration on apps/api/products.ts"
  );
});