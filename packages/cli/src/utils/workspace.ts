import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { cwd } from "node:process";

/**
 * Get the workspace root directory by searching for pnpm-workspace.yaml
 * First checks the current directory, then searches upward
 * Falls back to package.json if pnpm-workspace.yaml is not found
 */
export function getWorkspaceRoot(): string {
  const startDir = resolve(cwd());

  // First, check the current directory
  if (existsSync(join(startDir, "pnpm-workspace.yaml"))) {
    return startDir;
  }

  // Search upward for pnpm-workspace.yaml
  let current = startDir;
  const root = dirname(current);

  while (current !== root) {
    current = dirname(current);
    if (existsSync(join(current, "pnpm-workspace.yaml"))) {
      return current;
    }
  }

  // Fallback: use the directory with package.json (starting from cwd)
  current = startDir;
  if (existsSync(join(current, "package.json"))) {
    return current;
  }

  // Search upward for package.json
  while (current !== root) {
    current = dirname(current);
    if (existsSync(join(current, "package.json"))) {
      return current;
    }
  }

  // Ultimate fallback: use cwd
  return startDir;
}
