import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { cwd } from "node:process";

/**
 * Get the workspace root directory by searching upward for pnpm-workspace.yaml
 * This should be the directory where package.json and pnpm-workspace.yaml are located
 */
export function getWorkspaceRoot(): string {
  let current = resolve(cwd());
  const root = dirname(current);

  while (current !== root) {
    if (existsSync(join(current, "pnpm-workspace.yaml"))) {
      return current;
    }
    current = dirname(current);
  }

  // Fallback: check root directory
  if (existsSync(join(current, "pnpm-workspace.yaml"))) {
    return current;
  }

  throw new Error(
    "Could not find pnpm-workspace.yaml. Are you inside a pnpm workspace?"
  );
}
