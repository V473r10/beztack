import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { modules } from "./modules.js";
import { getWorkspaceRoot } from "./utils/workspace.js";

function moduleIsActive(modName: string): boolean {
  const mod = modules.find((m) => m.name === modName);
  if (!mod?.packageDir) {
    return true;
  }
  const workspaceRoot = getWorkspaceRoot();
  return existsSync(join(workspaceRoot, mod.packageDir));
}

export async function regenerateEntrypoints() {
  await generateApiModulesIndex();
  await generateUIRoutes();
}

function toPascal(name: string): string {
  return name.replace(/(^\w|-\w)/g, (m) => m.replace("-", "").toUpperCase());
}

async function generateApiModulesIndex() {
  const active = modules.filter((m) => moduleIsActive(m.name));
  const workspaceRoot = getWorkspaceRoot();

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
  await writeFile(target, content, "utf8");
}

async function generateUIRoutes() {
  const active = modules.filter((m) => moduleIsActive(m.name));
  const workspaceRoot = getWorkspaceRoot();

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
  await writeFile(target, content, "utf8");
}
