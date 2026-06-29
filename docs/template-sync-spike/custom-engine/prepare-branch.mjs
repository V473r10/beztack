#!/usr/bin/env node
/**
 * PR-ready branch preparation for the Beztack Template Sync engine.
 *
 * Given a derived project state, a Template revision, and a plan, this
 * module prepares a fresh working tree (the "branch") with the planned
 * file changes applied, the Sync state and Sync event log updated, and a
 * human-readable BRANCH_README.md explaining the work. The original
 * derived project is NEVER modified.
 *
 * This module implements the engine-side of the contract from
 * docs/template-sync-fixture/. It is intentionally minimal:
 *   - It does not run `git push` or open a PR; the human reviewer (or a
 *     follow-up CI step) does that.
 *   - It does not take full-workspace snapshots; rollback rides on the
 *     branch itself (ADR-0006).
 *   - It does not copy lockfiles from the Template source; the package
 *     manager regenerates them locally on the branch.
 */

import { mkdir, readFile, writeFile, copyFile, readdir, stat } from "node:fs/promises";
import { join, relative, dirname, basename, resolve as resolvePath } from "node:path";
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import {
  formatBranchReadme,
  summarizeApplyResult,
} from "./format.mjs";
import {
  formatMigrationReadme,
  buildMigrationStatus,
} from "./migrations.mjs";

const execFile = promisify(execFileCb);

async function ensureDir(path) {
  await mkdir(path, { recursive: true });
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

async function listFiles(root, base = root) {
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
      const rel = relative(base, abs);
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

function sha256(text) {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

async function fileSha256(path) {
  return sha256(await readFile(path, "utf8"));
}

/**
 * Recursively copy a directory. Skips `.git`. Symlinks are followed.
 */
async function copyDir(src, dest) {
  await ensureDir(dest);
  const entries = await readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".git") continue;
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else if (entry.isFile()) {
      await copyFile(srcPath, destPath);
    }
  }
}

/**
 * Render `{{param}}` placeholders in a string using the parameters map.
 * Only `{{ name }}` (with optional spaces) is supported; unknown names are
 * left as-is so reviewers can see what is missing.
 */
function renderPlaceholders(text, parameters) {
  return text.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (m, name) => {
    if (Object.prototype.hasOwnProperty.call(parameters, name)) {
      return String(parameters[name]);
    }
    return m;
  });
}

/**
 * Extract the "seam contents" from a file. The seam is a region that
 * starts after the line containing the seam marker and contains any line
 * that is not part of the harness function. For the spike the heuristic
 * is intentionally simple: take the trailing lines of the file that come
 * after the first line containing the seam marker but are not themselves
 * harness code. We use the comment-marker style "Derived project seam
 * contents" / "end seam" as a more reliable signal when present.
 */
function extractSeamContents(fileText, marker) {
  const lines = fileText.split("\n");
  const startIdx = lines.findIndex((line) => line.includes(marker));
  if (startIdx === -1) return null;

  const startMarker = lines.findIndex(
    (line) =>
      line.includes("seam contents") ||
      line.includes("DO NOT EDIT FROM TEMPLATE") ||
      line.includes("start seam")
  );
  const endMarker = lines.findIndex(
    (line) => line.includes("end seam") || line.includes("── end seam")
  );

  if (startMarker === -1 || endMarker === -1 || endMarker <= startMarker) {
    return null;
  }

  return lines.slice(startMarker, endMarker + 1).join("\n");
}

/**
 * Splice the seam region from the derived project's file into the
 * candidate's harness. The candidate's harness is taken as-is; the
 * seam contents are appended after the candidate's existing code.
 */
function spliceSeam(candidateText, derivedText, marker) {
  const seam = extractSeamContents(derivedText, marker);
  if (!seam) {
    return { text: candidateText, preservedSeam: false };
  }
  const trimmed = candidateText.endsWith("\n")
    ? candidateText
    : candidateText + "\n";
  return {
    text: `${trimmed}\n${seam}\n`,
    preservedSeam: true,
  };
}

/**
 * Merge the candidate's package.json with the derived project's
 * package.json. The candidate's keys win for shared fields (it is
 * Template-owned); the derived project's custom keys (anything not in
 * the candidate) are preserved. Dependencies and devDependencies are
 * union-merged: candidate values take precedence for shared names,
 * derived-project-only entries are kept. Template parameters are then
 * rendered into the resulting file.
 */
function mergePackageJson(candidateText, derivedText, parameters) {
  const candidate = JSON.parse(candidateText);
  const derived = JSON.parse(derivedText);
  const merged = { ...derived, ...candidate };
  for (const key of [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "scripts",
  ]) {
    if (candidate[key] || derived[key]) {
      merged[key] = { ...(derived[key] ?? {}), ...(candidate[key] ?? {}) };
    }
  }
  const rendered = renderPlaceholders(
    JSON.stringify(merged, null, 2) + "\n",
    parameters
  );
  return rendered;
}

async function loadTemplateFiles(revisionRoot) {
  const files = await listFiles(revisionRoot, revisionRoot);
  delete files["template.json"];
  return files;
}

function pickOwnership(policy, path) {
  let best = null;
  for (const rule of policy.ownership ?? []) {
    if (matchGlob(rule.path, path)) {
      if (
        best === null ||
        rule.path.length > best.path.length ||
        (rule.path.length === best.path.length &&
          rule.path.split("/").length > best.path.split("/").length)
      ) {
        best = rule;
      }
    }
  }
  return best ? best.strategy : "template-owned";
}

function findSeam(policy, path) {
  return (policy.seams ?? []).find((s) => s.file === path) ?? null;
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

function nowIso() {
  return new Date().toISOString();
}

function newEventId(derivedProjectId) {
  const tail = Date.now().toString(36).padStart(8, "0");
  const random = Math.floor(Math.random() * 0xffffff)
    .toString(36)
    .padStart(4, "0");
  return `evt_${derivedProjectId.slice(0, 16).toLowerCase()}${tail}${random}`;
}

/**
 * Prepare a PR-ready branch in `worktreePath` from the given plan.
 *
 * @param {object} args
 * @param {string} args.derivedRoot - Path to the current Derived project
 * @param {string} args.fromTemplateRoot - Path to the current Template revision
 * @param {string} args.toTemplateRoot - Path to the candidate Template revision
 * @param {string} args.worktreePath - Path where the new branch is prepared
 * @param {object} args.policy - Sync policy
 * @param {object} args.parameters - Template parameters
 * @param {object} args.origin - Current Origin baseline
 * @param {object} args.plan - Apply plan (from the engine)
 * @param {object} args.engineOutput - { name, version }
 * @param {boolean} [args.initGit] - If true, initialize a git repo in the worktree, create the branch, and commit
 * @returns {Promise<{worktree: string, branch: string, branchCreated: boolean, eventId: string, updates: number, skipped: number, conflicts: number}>}
 */
export async function prepareBranch({
  derivedRoot,
  fromTemplateRoot,
  toTemplateRoot,
  worktreePath,
  policy,
  parameters,
  origin,
  plan,
  engineOutput,
  initGit = false,
  projectTrustClass = "trusted",
}) {
  if (await pathExists(worktreePath)) {
    throw new Error(
      `worktree path already exists: ${worktreePath}. Engines must never overwrite an existing worktree.`
    );
  }

  await ensureDir(worktreePath);
  await copyDir(derivedRoot, worktreePath);

  const candidateFiles = await loadTemplateFiles(toTemplateRoot);
  const fromFiles = await loadTemplateFiles(fromTemplateRoot);

  const parametersValues = parameters?.values ?? {};

  let updatesApplied = 0;
  const seamLog = [];

  for (const u of plan.updates ?? []) {
    const srcPath = join(toTemplateRoot, u.path);
    const destPath = join(worktreePath, u.path);
    if (!(await pathExists(srcPath))) {
      continue;
    }
    let text = await readFile(srcPath, "utf8");

    const seam = findSeam(policy, u.path);
    const derivedPath = join(derivedRoot, u.path);
    if (seam && (await pathExists(derivedPath))) {
      const derivedText = await readFile(derivedPath, "utf8");
      const result = spliceSeam(text, derivedText, seam.marker);
      text = result.text;
      if (result.preservedSeam) {
        seamLog.push(`${u.path}: preserved ${seam.id} seam contents`);
      }
    }

    if (u.path === "package.json") {
      const derivedPkgPath = join(derivedRoot, "package.json");
      if (await pathExists(derivedPkgPath)) {
        const derivedPkgText = await readFile(derivedPkgPath, "utf8");
        text = mergePackageJson(text, derivedPkgText, parametersValues);
      } else {
        text = renderPlaceholders(text, parametersValues);
      }
    } else {
      text = renderPlaceholders(text, parametersValues);
    }

    await ensureDir(dirname(destPath));
    await writeFile(destPath, text, "utf8");
    updatesApplied += 1;
  }

  const newFiles = new Set();
  for (const path of Object.keys(candidateFiles)) {
    if (!(path in fromFiles)) newFiles.add(path);
  }

  const newOrigin = {
    ...origin,
    templateRevision: plan.toRevision,
    acceptedAt: nowIso(),
    files: {},
  };
  for (const path of Object.keys(candidateFiles)) {
    const filePath = join(toTemplateRoot, path);
    const h = await fileSha256(filePath);
    newOrigin.files[path] = {
      templateHash: h,
      projectHash: h,
    };
  }
  for (const path of Object.keys(fromFiles)) {
    if (newOrigin.files[path]) continue;
    const filePath = join(toTemplateRoot, path);
    if (await pathExists(filePath)) {
      const h = await fileSha256(filePath);
      newOrigin.files[path] = {
        templateHash: h,
        projectHash: h,
      };
    }
  }
  const derivedRemaining = await listFiles(worktreePath, worktreePath);
  for (const [path, abs] of Object.entries(derivedRemaining)) {
    if (newOrigin.files[path]) continue;
    if (path.startsWith(".beztack/")) continue;
    if (path === "BRANCH_README.md") continue;
    if (path === "BRANCH_NOTES.md") continue;
    if (path === ".git") continue;
    const h = await fileSha256(abs);
    newOrigin.files[path] = {
      templateHash: h,
      projectHash: h,
    };
  }

  const beztackDir = join(worktreePath, ".beztack");
  await ensureDir(beztackDir);
  await writeFile(
    join(beztackDir, "origin.json"),
    JSON.stringify(newOrigin, null, 2) + "\n",
    "utf8"
  );

  const newState = {
    schemaVersion: "1.0",
    derivedProjectId: origin.derivedProjectId,
    templateId: origin.templateId,
    currentRevision: plan.toRevision,
    candidateRevision: undefined,
    syncEngine: engineOutput,
    status: plan.conflicts && plan.conflicts.length > 0 ? "conflicts" : "ready-to-apply",
    files: {},
    conflicts: plan.conflicts ?? [],
    overlaps: [],
    migrations: [],
    recommendation: {
      action: "no-action",
      note: "Branch prepared. Resolve conflicts, regenerate the lockfile, and run any pending Template migrations before opening the PR.",
    },
  };

  for (const planMigration of plan.migrations ?? []) {
    const idempotencyPayload = { ...planMigration.idempotency };
    const statusMigration = await buildMigrationStatus({
      migration: {
        id: planMigration.id,
        mode: planMigration.mode,
        description: planMigration.description,
        idempotency: idempotencyPayload,
        interactive: planMigration.interactive,
        destructive: planMigration.destructive,
        trustClass: planMigration.trustClass,
        applyCommand: planMigration.applyCommand,
        note: planMigration.note,
        dryRun: planMigration.dryRunCommand ? { command: planMigration.dryRunCommand } : undefined,
      },
      derivedProjectRoot: worktreePath,
      projectTrustClass,
    });
    statusMigration.idempotencyStatus = planMigration.idempotencyStatus;
    newState.migrations.push(statusMigration);
  }
  for (const [path, meta] of Object.entries(newOrigin.files)) {
    const ownership = pickOwnership(policy, path);
    const seam = findSeam(policy, path);
    newState.files[path] = {
      ownership,
      drift: "unchanged",
      seam: seam ? seam.id : null,
    };
  }
  await writeFile(
    join(beztackDir, "sync-state.json"),
    JSON.stringify(newState, null, 2) + "\n",
    "utf8"
  );

  const eventLogPath = join(beztackDir, "sync-event-log.json");
  let eventLog;
  try {
    eventLog = JSON.parse(await readFile(eventLogPath, "utf8"));
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
    eventLog = {
      schemaVersion: "1.0",
      derivedProjectId: origin.derivedProjectId,
      templateId: origin.templateId,
      currentRevision: plan.toRevision,
      events: [],
    };
  }
  const eventId = newEventId(origin.derivedProjectId);
  const event = {
    eventSchemaVersion: "1.0",
    eventId,
    timestamp: nowIso(),
    type: "apply",
    syncEngine: engineOutput,
    details: {
      fromRevision: plan.fromRevision,
      toRevision: plan.toRevision,
      branch: plan.branch,
      updates: plan.updates?.length ?? 0,
      skipped: plan.skipped?.length ?? 0,
      conflicts: plan.conflicts?.length ?? 0,
      blockers: plan.blockers?.length ?? 0,
    },
  };
  eventLog.events.push(event);
  eventLog.currentRevision = plan.toRevision;
  await writeFile(
    eventLogPath,
    JSON.stringify(eventLog, null, 2) + "\n",
    "utf8"
  );

  const readme = formatBranchReadme({
    plan,
    derivedProjectId: origin.derivedProjectId,
    templateId: origin.templateId,
    targetPath: worktreePath,
  });
  await writeFile(join(worktreePath, "BRANCH_README.md"), readme, "utf8");

  const migrationsForReadme = (plan.migrations ?? []).map((m) => {
    const check = m.idempotency ?? {};
    let idempotencyCheck;
    if (check.type === "file-exists") {
      idempotencyCheck = `file-exists ${check.path ?? ""}`.trim();
    } else if (check.type === "marker-present") {
      idempotencyCheck = `marker-present ${check.path ?? ""} (looking for '${check.marker ?? ""}')`;
    } else if (check.type === "command-succeeds") {
      idempotencyCheck = `command-succeeds '${check.command ?? ""}' (engine does not run; treated as pending)`;
    } else {
      idempotencyCheck = `unknown idempotency type ${check.type ?? "undefined"}`;
    }
    return { ...m, idempotencyCheck };
  });

  const migrationsReadme = formatMigrationReadme({
    migrations: migrationsForReadme,
    planBranch: plan.branch,
    fromRevision: plan.fromRevision,
    toRevision: plan.toRevision,
    derivedProjectId: origin.derivedProjectId,
    projectTrustClass,
  });
  await writeFile(
    join(worktreePath, "MIGRATIONS.md"),
    migrationsReadme,
    "utf8"
  );

  let branchCreated = false;
  if (initGit) {
    await execFile("git", ["init", "--quiet"], { cwd: worktreePath });
    await execFile("git", ["checkout", "-q", "-b", plan.branch], {
      cwd: worktreePath,
    });
    await execFile(
      "git",
      ["add", "-A", ".beztack", "BRANCH_README.md", "MIGRATIONS.md"],
      { cwd: worktreePath }
    );
    for (const u of plan.updates ?? []) {
      const rel = u.path;
      if (rel === "package.json" || rel.startsWith("apps/") || rel === ".env.contract.json") {
        try {
          await execFile("git", ["add", "--", rel], { cwd: worktreePath });
        } catch {
          /* file may not exist after the merge step; ignore */
        }
      }
    }
    await execFile(
      "git",
      [
        "-c",
        "user.email=sync@beztack.local",
        "-c",
        "user.name=Beztack Sync",
        "commit",
        "-q",
        "-m",
        `template-sync: ${plan.fromRevision} -> ${plan.toRevision} (${plan.migrations?.filter((m) => m.idempotencyStatus === "pending" && m.execution === "manual-execution-required").length ?? 0} pending migrations)`,
      ],
      { cwd: worktreePath }
    );
    branchCreated = true;
  }

  return {
    worktree: worktreePath,
    branch: plan.branch,
    branchCreated,
    eventId,
    updates: updatesApplied,
    skipped: plan.skipped?.length ?? 0,
    conflicts: plan.conflicts?.length ?? 0,
    seamLog,
  };
}

export {
  renderPlaceholders,
  extractSeamContents,
  spliceSeam,
  mergePackageJson,
  newEventId,
};
