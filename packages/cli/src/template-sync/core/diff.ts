import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { promisify } from "node:util";
import { isTemplateExcludedPath } from "../../template-excludes.js";
import { isBinaryFileContent } from "../../utils/file-content.js";
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

interface FileMapEntry {
  isBinary: boolean;
  textContent?: string;
  binaryContent?: Buffer;
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
    const currentFile = currentFiles.get(path);
    const templateFile = templateFiles.get(path);

    if (currentFile === undefined && templateFile !== undefined) {
      changes.push(createAddChange(path, templateFile));
      continue;
    }

    if (currentFile !== undefined && templateFile === undefined) {
      changes.push(createDeleteChange(path, currentFile));
      continue;
    }

    if (currentFile === undefined || templateFile === undefined) {
      continue;
    }

    const currentHash = hashEntryContent(currentFile);
    const templateHash = hashEntryContent(templateFile);
    const hasChanged = currentHash !== templateHash;

    if (!hasChanged) {
      continue;
    }

    const originEntry = origin?.files[path];

    if (originEntry) {
      const templateChanged = templateHash !== originEntry.templateHash;

      if (!templateChanged) {
        skippedUnchangedTemplateFiles += 1;
        continue;
      }

      const userModified = currentHash !== originEntry.projectHash;

      changes.push(
        createModifyChange(path, currentFile, templateFile, userModified),
      );
      continue;
    }

    changes.push(createModifyChange(path, currentFile, templateFile));
  }

  return {
    changes: changes.sort((a, b) => a.path.localeCompare(b.path)),
    skippedUnchangedTemplateFiles,
  };
}

async function loadFileMap(root: string): Promise<Map<string, FileMapEntry>> {
  const entries = await listFiles(root);
  const map = new Map<string, FileMapEntry>();

  for (const absolutePath of entries) {
    const rel = normalizePath(relative(root, absolutePath));
    const content = await readFile(absolutePath);
    const isBinary = isBinaryFileContent(rel, content);
    if (isBinary) {
      map.set(rel, {
        isBinary: true,
        binaryContent: content,
      });
      continue;
    }

    map.set(rel, {
      isBinary: false,
      textContent: content.toString("utf-8"),
    });
  }

  return map;
}

function createAddChange(path: string, file: FileMapEntry): FileChange {
  if (file.isBinary) {
    return {
      path,
      type: "add",
      isBinary: true,
      templateBinaryContent: file.binaryContent,
    };
  }

  return {
    path,
    type: "add",
    isBinary: false,
    templateContent: file.textContent,
  };
}

function createDeleteChange(path: string, file: FileMapEntry): FileChange {
  if (file.isBinary) {
    return {
      path,
      type: "delete",
      isBinary: true,
      currentBinaryContent: file.binaryContent,
    };
  }

  return {
    path,
    type: "delete",
    isBinary: false,
    currentContent: file.textContent,
  };
}

function createModifyChange(
  path: string,
  currentFile: FileMapEntry,
  templateFile: FileMapEntry,
  userModified?: boolean,
): FileChange {
  const isBinary = currentFile.isBinary || templateFile.isBinary;
  if (isBinary) {
    return {
      path,
      type: "modify",
      isBinary: true,
      currentBinaryContent: toBuffer(currentFile),
      templateBinaryContent: toBuffer(templateFile),
      userModified,
    };
  }

  return {
    path,
    type: "modify",
    isBinary: false,
    currentContent: currentFile.textContent,
    templateContent: templateFile.textContent,
    userModified,
  };
}

function hashEntryContent(entry: FileMapEntry): string {
  return hashContent(toHashableContent(entry));
}

function toHashableContent(entry: FileMapEntry): string | Buffer {
  if (entry.isBinary) {
    return entry.binaryContent ?? Buffer.alloc(0);
  }
  return entry.textContent ?? "";
}

function toBuffer(entry: FileMapEntry): Buffer {
  if (entry.isBinary) {
    return entry.binaryContent ?? Buffer.alloc(0);
  }

  return Buffer.from(entry.textContent ?? "", "utf-8");
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
