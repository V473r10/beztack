import { copyFile, mkdir, readdir, rm } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

const SNAPSHOT_DIR = ".beztack/snapshots";

export async function createSnapshot(workspaceRoot: string): Promise<string> {
  const id = new Date().toISOString().replaceAll(":", "-");
  const sourceFiles = await listWorkspaceFiles(workspaceRoot, {
    includeBeztackInternal: false,
  });
  const snapshotRoot = join(workspaceRoot, SNAPSHOT_DIR, id);

  for (const absPath of sourceFiles) {
    const relPath = relative(workspaceRoot, absPath);
    const destPath = join(snapshotRoot, relPath);
    await mkdir(dirname(destPath), { recursive: true });
    await copyFile(absPath, destPath);
  }

  return id;
}

export async function rollbackSnapshot(
  workspaceRoot: string,
  snapshotId: string,
): Promise<void> {
  const snapshotRoot = join(workspaceRoot, SNAPSHOT_DIR, snapshotId);
  const snapshotFiles = await listWorkspaceFiles(snapshotRoot, {
    includeBeztackInternal: true,
  });
  const snapshotRelativePaths = new Set(
    snapshotFiles.map((absPath) =>
      relative(snapshotRoot, absPath).replaceAll("\\", "/"),
    ),
  );

  for (const absPath of snapshotFiles) {
    const relPath = relative(snapshotRoot, absPath);
    const destPath = join(workspaceRoot, relPath);
    await mkdir(dirname(destPath), { recursive: true });
    await copyFile(absPath, destPath);
  }

  const workspaceFiles = await listWorkspaceFiles(workspaceRoot, {
    includeBeztackInternal: false,
  });

  for (const absPath of workspaceFiles) {
    const relPath = relative(workspaceRoot, absPath).replaceAll("\\", "/");
    if (snapshotRelativePaths.has(relPath)) {
      continue;
    }

    await rm(absPath, { force: true });
  }
}

export async function clearSnapshots(workspaceRoot: string): Promise<void> {
  await rm(join(workspaceRoot, ".beztack"), {
    recursive: true,
    force: true,
  });
}

interface ListWorkspaceFilesOptions {
  includeBeztackInternal: boolean;
}

async function listWorkspaceFiles(
  root: string,
  options: ListWorkspaceFilesOptions,
): Promise<string[]> {
  const pending = [root];
  const files: string[] = [];

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) {
      continue;
    }

    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const absPath = join(current, entry.name);
      const relPath = relative(root, absPath).replaceAll("\\", "/");

      if (relPath === ".git" || relPath.startsWith(".git/")) {
        continue;
      }

      if (
        relPath === "node_modules" ||
        relPath.startsWith("node_modules/") ||
        (!options.includeBeztackInternal &&
          (relPath === ".beztack" || relPath.startsWith(".beztack/"))) ||
        relPath === ".beztack-sandbox" ||
        relPath.startsWith(".beztack-sandbox/") ||
        relPath === ".nx" ||
        relPath.startsWith(".nx/") ||
        relPath === "dist" ||
        relPath.startsWith("dist/")
      ) {
        continue;
      }

      if (entry.isDirectory()) {
        pending.push(absPath);
        continue;
      }

      if (entry.isFile()) {
        files.push(absPath);
      }
    }
  }

  return files;
}
