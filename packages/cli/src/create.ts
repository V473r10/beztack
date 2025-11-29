import { exec } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { cancel, confirm, group, spinner, text } from "@clack/prompts";
import { main as initModules } from "./cli.js";

const execAsync = promisify(exec);
const PROJECT_NAME_REGEX = /^[a-z0-9-]+$/;

interface ProjectConfig {
  name: string;
  description: string;
  initializeGit: boolean;
  installDependencies: boolean;
}

export async function createProject() {
  const config = await getProjectConfig();
  const projectDir = resolve(process.cwd(), config.name);

  await createProjectStructure(projectDir, config);

  if (config.installDependencies) {
    await installDependencies(projectDir);
  }

  // Change to project directory and run module configuration
  process.chdir(projectDir);
  await initModules();

  if (config.initializeGit) {
    await initializeGit(projectDir);
  }

  process.stdout.write("\nNext steps:\n");
  process.stdout.write(`  cd ${config.name}\n`);
  process.stdout.write("  cp apps/api/.env.example apps/api/.env\n");
  process.stdout.write("  cp apps/ui/.env.example apps/ui/.env\n");
  process.stdout.write("  cp apps/docs/.env.example apps/docs/.env\n");
  process.stdout.write("  # Configure your .env files\n");
  process.stdout.write("  pnpm run push\n");
  process.stdout.write("  pnpm run dev\n\n");
}

async function getProjectConfig(): Promise<ProjectConfig> {
  const config = await group(
    {
      name: () =>
        text({
          message: "Project name:",
          placeholder: "my-beztack-app",
          validate: (value: string) => {
            if (!value) {
              return "Project name is required";
            }
            if (!PROJECT_NAME_REGEX.test(value)) {
              return "Project name must be lowercase with hyphens";
            }
            return;
          },
        }),
      description: () =>
        text({
          message: "Project description:",
          placeholder: "My awesome Beztack project",
        }),
      initializeGit: () =>
        confirm({
          message: "Initialize Git repository?",
          initialValue: true,
        }),
      installDependencies: () =>
        confirm({
          message: "Install dependencies?",
          initialValue: true,
        }),
    },
    {
      onCancel: () => {
        cancel("Operation cancelled");
        process.exit(0);
      },
    }
  );

  return config as ProjectConfig;
}

async function createProjectStructure(
  projectDir: string,
  config: ProjectConfig
) {
  const templateRepoUrl = "https://github.com/V473r10/beztack.git";
  let tempDir = "";
  const spin = spinner();
  spin.start("Creating project structure");

  try {
    await mkdir(projectDir, { recursive: true });

    tempDir = await mkdtemp(join(tmpdir(), "beztack-template-"));
    spin.message(`Cloning template from ${templateRepoUrl}...`);
    await execAsync(`git clone --depth 1 ${templateRepoUrl} ${tempDir}`);
    spin.message("Copying project files...");

    const excludeDirs = [
      ".git",
      "node_modules",
      "scripts/create-beztack",
      ".github",
      ".nx",
      "docs",
    ];

    await copyDir({ src: tempDir, dest: projectDir, excludeDirs, config });

    // Update package.json with project info
    const packageJsonPath = join(projectDir, "package.json");
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf-8"));

    packageJson.name = config.name;
    packageJson.description = config.description || "";

    await writeFile(
      packageJsonPath,
      `${JSON.stringify(packageJson, null, 2)}\n`,
      "utf-8"
    );

    spin.stop("Project structure created");
  } catch (error) {
    spin.stop("Failed to create project structure");
    throw error;
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}

interface CopyDirOptions {
  src: string;
  dest: string;
  excludeDirs: string[];
  config: ProjectConfig;
  relativePath?: string;
}

async function copyDir(options: CopyDirOptions) {
  const { src, dest, excludeDirs, config, relativePath = "" } = options;
  const entries = await readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    const relativeEntryPath = join(relativePath, entry.name);

    if (excludeDirs.some((dir) => relativeEntryPath.startsWith(dir))) {
      continue;
    }

    if (entry.isDirectory()) {
      await mkdir(destPath, { recursive: true });
      await copyDir({
        src: srcPath,
        dest: destPath,
        excludeDirs,
        config,
        relativePath: relativeEntryPath,
      });
    } else {
      let content = await readFile(srcPath, "utf-8");

      content = content
        .replace(/{{project-name}}/g, config.name)
        .replace(/{{description}}/g, config.description || "");

      if (entry.name === ".env.example") {
        content = content.replace(
          /APP_NAME=beztack/g,
          `APP_NAME=${config.name}`
        );
      }

      await writeFile(destPath, content, "utf-8");
    }
  }
}

async function installDependencies(projectDir: string) {
  const spin = spinner();
  spin.start("Installing dependencies");

  try {
    // Remove create-beztack from workspaces if it exists
    const packageJsonPath = join(projectDir, "package.json");
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf-8"));

    if (packageJson.workspaces) {
      packageJson.workspaces = packageJson.workspaces.filter(
        (ws: string) => ws !== "scripts/create-beztack"
      );

      if (packageJson.workspaces.length === 0) {
        packageJson.workspaces = undefined;
      }

      await writeFile(
        packageJsonPath,
        `${JSON.stringify(packageJson, null, 2)}\n`,
        "utf-8"
      );
    }

    await execAsync("pnpm install", { cwd: projectDir });
    spin.stop("Dependencies installed");
  } catch (error) {
    spin.stop("Failed to install dependencies");
    throw error;
  }
}

async function initializeGit(projectDir: string) {
  const spin = spinner();
  spin.start("Initializing Git repository");

  try {
    await execAsync("git init", { cwd: projectDir });
    await execAsync("git add .", { cwd: projectDir });
    await commitWithFallback(projectDir);
    spin.stop("Git repository initialized");
  } catch (error) {
    spin.stop("Failed to initialize Git repository");
    process.stderr.write("  - Git initialization failed, continuing...\n");
    if (error instanceof Error) {
      process.stderr.write(`  - Error details: ${error.message}\n`);
    }
  }
}

async function commitWithFallback(projectDir: string) {
  try {
    await execAsync('git commit -m "Initial commit"', { cwd: projectDir });
  } catch (commitError) {
    if (commitError instanceof Error) {
      process.stderr.write(`Commit error: ${commitError.message}\n`);
    }

    try {
      await execAsync("git rev-parse HEAD", { cwd: projectDir });
    } catch {
      process.stderr.write(
        "Failed to verify commit. Git initialization might be incomplete.\n"
      );
      throw commitError;
    }
  }
}
