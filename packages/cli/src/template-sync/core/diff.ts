import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { promisify } from "node:util";
import { isTemplateExcludedPath } from "../../template-excludes.js";
import { hashContent, readOrigin } from "./origin.js";
import type { FileChange } from "./types.js";

const execFileAsync = promisify(execFile);

const EXCLUDED_SEGMENTS = new Set([
  ".git",
  "node_modules",
  ".nx",
  "dist",
  ".beztack",
  ".beztack-sandbox",
  "pnpm-lock.yaml",
  "beztack.template.json",
  "beztack-sync-report.md",
]);

interface DiffComputationResult {
  changes: FileChange[];
  skippedUnchangedTemplateFiles: number;
}

/**
 * Computes the difference between the file system of the workspace and the template.
 * It returns an array of FileChange objects, each representing a single file change.
 * The array is sorted by file path.
 *
 * @param {string} workspaceRoot - The root directory of the workspace.
 * @param {string} templateRoot - The root directory of the template.
 * @returns {Promise<FileChange[]>} A promise that resolves with an array of FileChange objects.
 */
export async function computeDiff(
  workspaceRoot: string,
  templateRoot: string,
): Promise<DiffComputationResult> {
  const currentFiles = await loadFileMap(workspaceRoot);
  const templateFiles = await loadFileMap(templateRoot);
  const origin = await readOrigin(workspaceRoot);
  const allPaths = new Set([...currentFiles.keys(), ...templateFiles.keys()]);
  const changes: FileChange[] = [];
  let skippedUnchangedTemplateFiles = 0;

  for (const path of allPaths) {
    const currentContent = currentFiles.get(path);
    const templateContent = templateFiles.get(path);

    if (currentContent === undefined && templateContent !== undefined) {
      changes.push({ path, type: "add", templateContent });
      continue;
    }

    if (currentContent !== undefined && templateContent === undefined) {
      changes.push({ path, type: "delete", currentContent });
      continue;
    }

    if (
      currentContent !== undefined &&
      templateContent !== undefined &&
      currentContent !== templateContent
    ) {
      const originEntry = origin?.files[path];

      if (originEntry) {
        const templateHash = hashContent(templateContent);
        const templateChanged = templateHash !== originEntry.templateHash;

        if (!templateChanged) {
          skippedUnchangedTemplateFiles += 1;
          continue;
        }

        const workspaceHash = hashContent(currentContent);
        const userModified = workspaceHash !== originEntry.projectHash;

        changes.push({
          path,
          type: "modify",
          currentContent,
          templateContent,
          userModified,
        });
        continue;
      }

      changes.push({
        path,
        type: "modify",
        currentContent,
        templateContent,
      });
    }
  }

  return {
    changes: changes.sort((a, b) => a.path.localeCompare(b.path)),
    skippedUnchangedTemplateFiles,
  };
}

async function loadFileMap(root: string): Promise<Map<string, string>> {
  const entries = await listFiles(root);
  const map = new Map<string, string>();

  for (const absolutePath of entries) {
    const rel = normalizePath(relative(root, absolutePath));
    const content = await readFile(absolutePath, "utf-8");
    map.set(rel, content);
  }

  return map;
}

async function listFiles(root: string): Promise<string[]> {
  const collected: string[] = [];
  const pending: string[] = [root];

  while (pending.length > 0) {
    const currentDir = pending.pop();
    if (!currentDir) {
      continue;
    }

    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        const rel = normalizePath(relative(root, absolutePath));
        if (shouldExclude(rel)) {
          continue;
        }
        pending.push(absolutePath);
        continue;
      }

      if (entry.isFile()) {
        const rel = normalizePath(relative(root, absolutePath));
        if (shouldExclude(rel)) {
          continue;
        }
        collected.push(absolutePath);
      }
    }
  }

  return filterGitIgnoredFiles(root, collected);
}

async function filterGitIgnoredFiles(
  root: string,
  absolutePaths: string[],
): Promise<string[]> {
  if (absolutePaths.length === 0) {
    return absolutePaths;
  }

  if (!existsSync(join(root, ".git"))) {
    return absolutePaths;
  }

  const relativePaths = absolutePaths.map((absolutePath) =>
    normalizePath(relative(root, absolutePath)),
  );
  const ignored = await findGitIgnoredPaths(root, relativePaths);

  return absolutePaths.filter((absolutePath) => {
    const rel = normalizePath(relative(root, absolutePath));
    return !ignored.has(rel);
  });
}

async function findGitIgnoredPaths(
  root: string,
  relativePaths: string[],
): Promise<Set<string>> {
  const ignored = new Set<string>();

  const chunkSize = 200;
  for (let index = 0; index < relativePaths.length; index += chunkSize) {
    const chunk = relativePaths.slice(index, index + chunkSize);
    try {
      const { stdout } = await execFileAsync("git", [
        "-C",
        root,
        "check-ignore",
        "--no-index",
        "--",
        ...chunk,
      ]);

      const lines = stdout
        .split("\n")
        .map((line) => normalizePath(line.trim()))
        .filter((line) => line.length > 0);

      for (const line of lines) {
        ignored.add(line);
      }
    } catch (error) {
      if (isNoIgnoredMatchError(error)) {
        continue;
      }

      return ignored;
    }
  }

  return ignored;
}

function isNoIgnoredMatchError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  return error.code === 1;
}

function shouldExclude(relativePath: string): boolean {
  if (relativePath.length === 0) {
    return false;
  }

  if (isTemplateExcludedPath(relativePath)) {
    return true;
  }

  const pathSegments = relativePath.split("/");

  for (const segment of pathSegments) {
    if (EXCLUDED_SEGMENTS.has(segment)) {
      return true;
    }
  }

  return false;
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/");
}
