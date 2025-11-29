import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { modules } from "./modules.js";
import { getWorkspaceRoot } from "./utils/workspace.js";

/**
 * Check if a module's package exists in packages/
 * If no packageDir is defined, the module is always considered active
 */
function packageExists(modName: string): boolean {
  const mod = modules.find((m) => m.name === modName);
  if (!mod?.packageDir) {
    return true;
  }
  const workspaceRoot = getWorkspaceRoot();
  return existsSync(join(workspaceRoot, mod.packageDir));
}

/**
 * Check if a module's API implementation exists in apps/api/server/modules/
 */
function apiModuleExists(modName: string): boolean {
  const mod = modules.find((m) => m.name === modName);
  // If module definition says it doesn't have an API module, return false
  if (!mod?.hasApiModule) {
    return false;
  }
  const workspaceRoot = getWorkspaceRoot();
  const modulePath = join(
    workspaceRoot,
    `apps/api/server/modules/${modName}/index.ts`
  );
  return existsSync(modulePath);
}

/**
 * Check if a module's UI routes exist in apps/ui/src/features/
 */
function uiRoutesExist(modName: string): boolean {
  const mod = modules.find((m) => m.name === modName);
  // If module definition says it doesn't have UI feature, return false
  if (!mod?.hasUiFeature) {
    return false;
  }
  const workspaceRoot = getWorkspaceRoot();
  // Check for both .ts and .tsx extensions
  const tsPath = join(
    workspaceRoot,
    `apps/ui/src/features/${modName}/routes.ts`
  );
  const tsxPath = join(
    workspaceRoot,
    `apps/ui/src/features/${modName}/routes.tsx`
  );
  return existsSync(tsPath) || existsSync(tsxPath);
}

export async function regenerateEntrypoints() {
  await generateApiModulesIndex();
  await generateUIRoutes();
}

function toPascal(name: string): string {
  return name.replace(/(^\w|-\w)/g, (m) => m.replace("-", "").toUpperCase());
}

async function generateApiModulesIndex() {
  const workspaceRoot = getWorkspaceRoot();
  // Only include modules that have both: package exists AND API implementation exists
  const active = modules.filter(
    (m) => packageExists(m.name) && apiModuleExists(m.name)
  );

  const imports: string[] = [];
  const entries: string[] = [];

  for (const mod of active) {
    const baseName = toPascal(mod.name);
    const varName = `${baseName}Module`;
    imports.push(`import { ${varName} } from "./${mod.name}/index.js";`);
    entries.push(`\t${varName},`);
  }

  const content = `// AUTO-GENERATED – DO NOT EDIT
${imports.join("\n")}

export const modules = [
${entries.join("\n")}
];
`;

  const target = join(workspaceRoot, "apps/api/server/modules/index.ts");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
}

async function generateUIRoutes() {
  const workspaceRoot = getWorkspaceRoot();
  // Only include modules that have both: package exists AND UI routes exist
  const active = modules.filter(
    (m) => packageExists(m.name) && uiRoutesExist(m.name)
  );

  const imports: string[] = [];
  const entries: string[] = [];

  for (const mod of active) {
    const baseName = toPascal(mod.name);
    const varName = `${baseName}Routes`;
    imports.push(
      `import { ${varName} } from "./features/${mod.name}/routes.js";`
    );
    entries.push(`\t...${varName},`);
  }

  const content = `// AUTO-GENERATED – DO NOT EDIT
${imports.join("\n")}

export const routes = [
${entries.join("\n")}
];
`;

  const target = join(workspaceRoot, "apps/ui/src/routes.tsx");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
}
