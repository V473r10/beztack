import { rm } from "node:fs/promises";
import { join } from "node:path";
import { glob } from "glob";
import pc from "picocolors";
import { modules } from "./modules.js";
import { getNxProjectsRootsForModule } from "./utils/get-nx-project-roots.js";
import { removeDepsFromPackageJson } from "./utils/remove-deps.js";
import { getWorkspaceRoot } from "./utils/workspace.js";

interface RemoveModuleOptions {
  skipInstall?: boolean; // Reserved for future use
}

export async function removeModule(
  name: string,
  _options: RemoveModuleOptions = {}
) {
  const mod = modules.find((m) => m.name === name);
  if (!mod) {
    throw new Error(`Unknown module: ${name}`);
  }
  if (mod.required) {
    throw new Error(`Module ${name} is required and cannot be removed`);
  }

  const workspaceRoot = getWorkspaceRoot();

  // 1. Eliminar carpeta de packages
  await removePackageDir(workspaceRoot, mod.packageDir);

  // 2. Limpiar package.json de proyectos Nx afectados
  await cleanProjectDependencies(mod);

  // 3. Eliminar archivos relacionados
  await removeModuleFiles(workspaceRoot, mod.fileGlobs);

  // 4. Ejecutar codemods
  await runCodemods(mod.codemods);
}

async function removePackageDir(
  workspaceRoot: string,
  packageDir?: string
): Promise<void> {
  if (!packageDir) {
    return;
  }

  await rm(join(workspaceRoot, packageDir), {
    recursive: true,
    force: true,
  });
}

async function cleanProjectDependencies(mod: {
  nxProjects?: string[];
  npmDeps?: string[];
}): Promise<void> {
  if (!(mod.nxProjects && mod.npmDeps?.length)) {
    return;
  }

  const roots = getNxProjectsRootsForModule(mod.nxProjects);
  for (const root of roots) {
    await removeDepsFromPackageJson(root, mod.npmDeps);
  }
}

async function removeModuleFiles(
  workspaceRoot: string,
  fileGlobs?: string[]
): Promise<void> {
  if (!fileGlobs?.length) {
    return;
  }

  for (const pattern of fileGlobs) {
    const files = await glob(pattern, { cwd: workspaceRoot });
    for (const file of files) {
      await rm(join(workspaceRoot, file), {
        recursive: true,
        force: true,
      });
    }
  }
}

async function runCodemods(codemods?: string[]): Promise<void> {
  if (!codemods?.length) {
    return;
  }

  for (const codemod of codemods) {
    try {
      const { run } = await import(`./codemods/${codemod}.js`);
      await run();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(
        pc.yellow(`Warning: Failed to run codemod ${codemod}: ${message}\n`)
      );
    }
  }
}
