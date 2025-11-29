import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getWorkspaceRoot } from "./workspace.js";

export async function removeDepsFromPackageJson(
  projectRoot: string,
  deps: string[]
) {
  const workspaceRoot = getWorkspaceRoot();
  const packageJsonPath = join(workspaceRoot, projectRoot, "package.json");

  try {
    const content = await readFile(packageJsonPath, "utf-8");
    const json = JSON.parse(content);

    const sections = [
      "dependencies",
      "devDependencies",
      "peerDependencies",
      "optionalDependencies",
    ] as const;

    for (const section of sections) {
      if (!json[section]) {
        continue;
      }
      for (const dep of deps) {
        delete json[section][dep];
      }
    }

    await writeFile(
      packageJsonPath,
      `${JSON.stringify(json, null, 2)}\n`,
      "utf-8"
    );
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      // File doesn't exist, skip
      return;
    }
    throw error;
  }
}
