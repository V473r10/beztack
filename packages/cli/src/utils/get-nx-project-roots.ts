import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getWorkspaceRoot } from "./workspace.js";

/**
 * Get the root directories of Nx projects by their names
 * This is a simplified version that doesn't require @nx/devkit
 * It reads project.json files to find project roots
 */
export function getNxProjectsRootsForModule(projectNames: string[]): string[] {
  const workspaceRoot = getWorkspaceRoot();
  const roots: string[] = [];
  const projectLocations = ["apps", "packages"];

  for (const projectName of projectNames) {
    const found = findProjectInLocations(
      workspaceRoot,
      projectName,
      projectLocations
    );
    if (found) {
      roots.push(found);
    }
  }

  return roots;
}

function findProjectInLocations(
  workspaceRoot: string,
  projectName: string,
  locations: string[]
): string | null {
  // First, check standard locations
  for (const location of locations) {
    const projectPath = join(location, projectName);
    if (projectExists(workspaceRoot, projectPath)) {
      return projectPath;
    }
  }

  // If not found, scan directories
  for (const location of locations) {
    const locationPath = join(workspaceRoot, location);
    if (!existsSync(locationPath)) {
      continue;
    }

    const entries = readdirSync(locationPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name === projectName) {
        return join(location, projectName);
      }
    }
  }

  return null;
}

function projectExists(workspaceRoot: string, projectPath: string): boolean {
  const projectJsonPath = join(workspaceRoot, projectPath, "project.json");
  if (existsSync(projectJsonPath)) {
    return true;
  }

  const packageJsonPath = join(workspaceRoot, projectPath, "package.json");
  return existsSync(packageJsonPath);
}
