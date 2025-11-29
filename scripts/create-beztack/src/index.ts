#!/usr/bin/env node

import { exec, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  cancel,
  confirm,
  group,
  intro,
  outro,
  spinner,
  text,
} from "@clack/prompts";

const execAsync = promisify(exec);
const PROJECT_NAME_REGEX = /^[a-z0-9-]+$/;
const __dirname = dirname(fileURLToPath(import.meta.url));

interface ProjectConfig {
  name: string;
  description: string;
  initializeGit: boolean;
  installDependencies: boolean;
}

/**
 * Detect if we're running in development mode (from the monorepo source)
 */
function isDevMode(): boolean {
  // Check if we're in the monorepo by looking for the CLI source
  const monorepoCliPath = resolve(
    __dirname,
    "../../../packages/cli/dist/cli.js"
  );
  return existsSync(monorepoCliPath);
}

/**
 * Get the path to the beztack CLI
 * In development: use the local compiled CLI from the monorepo
 * In production: use npx to run from npm registry
 */
function getBeztackCommand(): { command: string; args: string[] } {
  if (isDevMode()) {
    const cliPath = resolve(__dirname, "../../../packages/cli/dist/cli.js");
    return { command: "node", args: [cliPath, "init"] };
  }
  // Production: run from npm registry
  return { command: "npx", args: ["beztack", "init"] };
}

function runBeztackInit(projectDir: string) {
  const spin = spinner();
  spin.start("Configuring modules");

  try {
    const { command, args } = getBeztackCommand();

    const result = spawnSync(command, args, {
      cwd: projectDir,
      stdio: "inherit",
    });

    if (result.status !== 0) {
      throw new Error(`Command failed with exit code ${result.status}`);
    }

    spin.stop("Modules configured");
  } catch (error) {
    spin.stop("Failed to configure modules");
    throw error;
  }
}

async function main() {
  console.clear();

  intro("🚀 Welcome to Beztack - A Modern NX Monorepo Starter");

  try {
    const config = await getProjectConfig();
    const projectDir = resolve(process.cwd(), config.name);

    await createProjectStructure(projectDir, config);

    if (config.installDependencies) {
      await installDependencies(projectDir);
    }

    // Run beztack init to configure modules (after dependencies are installed)
    runBeztackInit(projectDir);

    if (config.initializeGit) {
      await initializeGit(projectDir);
    }

    outro("🎉 Project created successfully!");
    console.log("\nNext steps:");
    console.log(`  cd ${config.name}`);
    console.log("  cp .env.example .env");
    console.log("  # Configure your .env file");
    console.log("  pnpm run migrate");
    console.log("  pnpm run dev\n");
  } catch (error) {
    cancel(error instanceof Error ? error.message : "Operation cancelled");
    process.exit(1);
  }
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
    // Create project directory
    await mkdir(projectDir, { recursive: true });

    tempDir = await mkdtemp(join(tmpdir(), "beztack-template-"));
    spin.message(`Cloning template from ${templateRepoUrl}...`);
    await execAsync(`git clone --depth 1 ${templateRepoUrl} ${tempDir}`);
    spin.message("Copying project files...");

    // Define exclusions relative to the root of the cloned template
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
    await rm(tempDir, { recursive: true, force: true });
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

    // Skip excluded directories
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
      // Process file content for template variables
      let content = await readFile(srcPath, "utf-8");

      // Replace template variables in all files
      content = content
        .replace(/{{project-name}}/g, config.name)
        .replace(/{{description}}/g, config.description || "");

      // For .env.example, also replace APP_NAME value
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

    // Install dependencies using pnpm
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
    // Not critical, so we don't throw
    console.warn("  - Git initialization failed, continuing...");
    if (error instanceof Error) {
      console.warn(`  - Error details: ${error.message}`);
    }
  }
}

async function commitWithFallback(projectDir: string) {
  try {
    await execAsync('git commit -m "Initial commit"', { cwd: projectDir });
  } catch (commitError) {
    if (commitError instanceof Error) {
      console.warn(`Commit error: ${commitError.message}`);
    }

    // Verify if commit was made despite error
    try {
      await execAsync("git rev-parse HEAD", { cwd: projectDir });
    } catch {
      console.error(
        "Failed to verify commit. Git initialization might be incomplete."
      );
      throw commitError;
    }
  }
}

main().catch(console.error);
