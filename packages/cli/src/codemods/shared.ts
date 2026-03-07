import { join } from "node:path";
import { glob } from "glob";
import { Project } from "ts-morph";
import { getWorkspaceRoot } from "../utils/workspace.js";

export async function removeImportsForPackage(packageName: string) {
  await removeImportsByPattern([
    new RegExp(`^${packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:/|$)`),
  ]);
}

export async function removeImportsByPattern(patterns: RegExp[]) {
  const workspaceRoot = getWorkspaceRoot();
  const project = new Project({
    tsConfigFilePath: join(workspaceRoot, "tsconfig.base.json"),
  });

  const files = await glob("apps/**/*.{ts,tsx}", { cwd: workspaceRoot });

  for (const relative of files) {
    const full = join(workspaceRoot, relative);
    const sf = project.addSourceFileAtPathIfExists(full);
    if (!sf) {
      continue;
    }

    for (const imp of sf.getImportDeclarations()) {
      const mod = imp.getModuleSpecifierValue();
      if (patterns.some((pattern) => pattern.test(mod))) {
        imp.remove();
      }
    }
  }

  await project.save();
}
