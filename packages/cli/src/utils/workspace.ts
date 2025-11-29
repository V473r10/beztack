import { resolve } from "node:path";
import { cwd } from "node:process";

/**
 * Get the workspace root directory
 * This should be the directory where package.json and pnpm-workspace.yaml are located
 */
export function getWorkspaceRoot(): string {
  return resolve(cwd());
}
