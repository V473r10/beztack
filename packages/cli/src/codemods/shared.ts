import { join } from "node:path";
import { glob } from "glob";
import { Project } from "ts-morph";
import { getWorkspaceRoot } from "../utils/workspace.js";

export async function removeImportsForPackage(packageName: string) {
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
      if (mod === packageName || mod.startsWith(`${packageName}/`)) {
        imp.remove();
      }
    }
  }

  await project.save();
}
