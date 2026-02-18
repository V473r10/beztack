import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { TemplateManifest } from "./types.js";

const MANIFEST_FILE = "beztack.template.json";

const DEFAULT_MANIFEST: TemplateManifest = {
  templateId: "beztack-core",
  currentVersion: "0.0.0",
  strategyByPath: {
    "**": "mixed",
  },
  appliedMigrations: [],
};

export function getManifestPath(workspaceRoot: string): string {
  return join(workspaceRoot, MANIFEST_FILE);
}

/**
 * Reads the template manifest from the given workspace root.
 * If the manifest file does not exist, returns the default manifest.
 * @param {string} workspaceRoot - The root of the workspace.
 * @returns {Promise<TemplateManifest>} - The template manifest.
 */
export async function readManifest(
  workspaceRoot: string,
): Promise<TemplateManifest> {
  const manifestPath = getManifestPath(workspaceRoot);

  try {
    const raw = await readFile(manifestPath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<TemplateManifest>;
    return normalizeManifest(parsed);
  } catch {
    return DEFAULT_MANIFEST;
  }
}

export async function writeManifest(
  workspaceRoot: string,
  manifest: TemplateManifest,
): Promise<void> {
  const manifestPath = getManifestPath(workspaceRoot);
  const normalized = normalizeManifest(manifest);
  await writeFile(manifestPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf-8");
}

function normalizeManifest(input: Partial<TemplateManifest>): TemplateManifest {
  return {
    templateId:
      typeof input.templateId === "string" && input.templateId.length > 0
        ? input.templateId
        : DEFAULT_MANIFEST.templateId,
    currentVersion:
      typeof input.currentVersion === "string" &&
      input.currentVersion.length > 0
        ? input.currentVersion
        : DEFAULT_MANIFEST.currentVersion,
    lastAppliedAt:
      typeof input.lastAppliedAt === "string" ? input.lastAppliedAt : undefined,
    strategyByPath:
      input.strategyByPath && Object.keys(input.strategyByPath).length > 0
        ? input.strategyByPath
        : DEFAULT_MANIFEST.strategyByPath,
    customZones: input.customZones,
    appliedMigrations: Array.isArray(input.appliedMigrations)
      ? input.appliedMigrations.filter(
          (migration): migration is string =>
            typeof migration === "string" && migration.length > 0,
        )
      : DEFAULT_MANIFEST.appliedMigrations,
  };
}
