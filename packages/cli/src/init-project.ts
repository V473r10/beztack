import { exec as execCb } from "node:child_process";
import { promisify } from "node:util";
import { regenerateEntrypoints } from "./generate-entrypoints.js";
import { modules } from "./modules.js";
import { removeModule } from "./remove-module.js";
import { getWorkspaceRoot } from "./utils/workspace.js";

const exec = promisify(execCb);

export async function initProject(enabledModuleNames: string[]) {
  const allModules = modules;
  const enabledSet = new Set(enabledModuleNames);
  const disabled = allModules.filter((m) => !enabledSet.has(m.name));

  // 1. Remove disabled modules (skip pnpm install for each)
  for (const mod of disabled) {
    if (mod.required) {
      continue;
    }
    await removeModule(mod.name, { skipInstall: true });
  }

  // 2. Regenerate entrypoints (routes, module index, etc.)
  await regenerateEntrypoints();

  // 3. Run a single pnpm install at the workspace root
  const workspaceRoot = getWorkspaceRoot();
  await exec("pnpm install", { cwd: workspaceRoot });
}
