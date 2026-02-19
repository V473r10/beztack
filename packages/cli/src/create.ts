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
import { join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import {
  cancel,
  confirm,
  group,
  isCancel,
  multiselect,
  spinner,
  text,
} from "@clack/prompts";
import { debugLog, debugOutput } from "./debug.js";
import {
  hashContent,
  writeOrigin,
  type Origin,
  type OriginFileEntry,
} from "./template-sync/core/origin.js";
import { initProject } from "./init-project.js";
import { modules } from "./modules.js";
import { isTemplateExcludedPath } from "./template-excludes.js";

const execAsyncBase = promisify(exec);
const PROJECT_NAME_REGEX = /^[a-z0-9-]+$/;
const BYTES_PER_KB = 1024;
const KB_PER_MB = 1024;
const BUFFER_SIZE_MB = 10;
const MAX_BUFFER = BUFFER_SIZE_MB * KB_PER_MB * BYTES_PER_KB;

interface ExecOptions {
  cwd?: string;
  maxBuffer?: number;
  encoding?: BufferEncoding;
}

async function execAsync(
  command: string,
  options?: ExecOptions
): Promise<{ stdout: string; stderr: string }> {
  debugLog(`Executing: ${command}`);
  const result = await execAsyncBase(command, {
    maxBuffer: MAX_BUFFER,
    encoding: "utf-8",
    ...options,
  });
  const stdout = String(result.stdout);
  const stderr = String(result.stderr);
  debugOutput(command, stdout, stderr);
  return { stdout, stderr };
}

interface ProjectConfig {
  name: string;
  description: string;
  initializeGit: boolean;
  installDependencies: boolean;
  initializeModules: boolean;
  nonInteractive: boolean;
  templateSource: string;
}

export interface CreateProjectOptions {
  name?: string;
  description?: string;
  initializeGit?: boolean;
  installDependencies?: boolean;
  initializeModules?: boolean;
  nonInteractive?: boolean;
  templateSource?: string;
}

export async function createProject(
  options: CreateProjectOptions = {}
) {
  const config = await getProjectConfig(options);
  const projectDir = resolve(process.cwd(), config.name);

  const templateHashes = await createProjectStructure(projectDir, config);

  if (config.installDependencies) {
    await installDependencies(projectDir);
  }

  if (config.initializeModules) {
    await configureModules(projectDir, config.nonInteractive);
  }

  await generateOrigin(projectDir, templateHashes);

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

async function getProjectConfig(
  options: CreateProjectOptions
): Promise<ProjectConfig> {
  if (options.nonInteractive === true) {
    const name = options.name ?? "my-beztack-app";
    const validationError = validateProjectName(name);
    if (typeof validationError === "string") {
      throw new Error(
        `Invalid project name "${name}": ${validationError}`
      );
    }

    return {
      name,
      description: options.description ?? "",
      initializeGit: options.initializeGit ?? true,
      installDependencies: options.installDependencies ?? true,
      initializeModules: options.initializeModules ?? true,
      nonInteractive: true,
      templateSource:
        options.templateSource ??
        "https://github.com/V473r10/beztack.git",
    };
  }

  const config = await group(
    {
      name: () =>
        text({
          message: "Project name:",
          placeholder: "my-beztack-app",
          validate: validateProjectName,
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
      initializeModules: () =>
        confirm({
          message: "Configure optional modules now?",
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

  return {
    ...(config as Omit<ProjectConfig, "nonInteractive">),
    nonInteractive: false,
    templateSource: "https://github.com/V473r10/beztack.git",
  };
}

function validateProjectName(value: string): string | undefined {
  if (!value) {
    return "Project name is required";
  }
  if (!PROJECT_NAME_REGEX.test(value)) {
    return "Project name must be lowercase with hyphens";
  }
  return;
}

async function configureModules(
  projectDir: string,
  nonInteractive: boolean
) {
  process.chdir(projectDir);

  const requiredModuleNames = modules
    .filter((moduleDefinition) => moduleDefinition.required)
    .map((moduleDefinition) => moduleDefinition.name);

  if (nonInteractive) {
    const spin = spinner();
    spin.start("Configuring required modules...");
    try {
      await initProject(requiredModuleNames);
      spin.stop("Required modules configured");
    } catch (error) {
      spin.stop("Failed to configure required modules");
      throw error;
    }
    return;
  }

  const optionalModules = modules.filter((moduleDefinition) =>
    !moduleDefinition.required
  );

  if (optionalModules.length === 0) {
    return;
  }

  const selected = await multiselect({
    message: "Select the modules you want to include:",
    options: optionalModules.map((moduleDefinition) => ({
      value: moduleDefinition.name,
      label: moduleDefinition.label,
      hint: moduleDefinition.description,
    })),
    required: false,
  });

  if (isCancel(selected)) {
    cancel("Operation cancelled.");
    process.exit(0);
  }

  const enabledModuleNames = [
    ...requiredModuleNames,
    ...(selected as string[]),
  ];

  const spin = spinner();
  spin.start("Configuring modules...");

  try {
    await initProject(enabledModuleNames);
    spin.stop("Modules configured.");
  } catch (error) {
    spin.stop("Failed to configure modules.");
    throw error;
  }
}

async function createProjectStructure(
  projectDir: string,
  config: ProjectConfig
): Promise<Map<string, string>> {
  const templateRepoUrl = config.templateSource;
  let tempDir: string | undefined;
  const spin = spinner();
  spin.start("Creating project structure");

  try {
    await mkdir(projectDir, { recursive: true });

    tempDir = await mkdtemp(join(tmpdir(), "beztack-template-"));
    spin.message(`Cloning template from ${templateRepoUrl}...`);
    await execAsync(`git clone --depth 1 ${templateRepoUrl} ${tempDir}`);
    spin.message("Copying project files...");

    const templateHashes = new Map<string, string>();
    await copyDir({
      src: tempDir,
      dest: projectDir,
      config,
      templateHashes,
    });

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
    return templateHashes;
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
  config: ProjectConfig;
  relativePath?: string;
  templateHashes: Map<string, string>;
}

async function copyDir(options: CopyDirOptions) {
  const { src, dest, config, relativePath = "", templateHashes } = options;
  const entries = await readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    const relativeEntryPath = join(relativePath, entry.name);
    const normalizedRelPath = relativeEntryPath.replaceAll("\\", "/");

    if (isTemplateExcludedPath(normalizedRelPath)) {
      continue;
    }

    if (entry.isDirectory()) {
      await mkdir(destPath, { recursive: true });
      await copyDir({
        src: srcPath,
        dest: destPath,
        config,
        relativePath: relativeEntryPath,
        templateHashes,
      });
    } else {
      const rawContent = await readFile(srcPath, "utf-8");
      templateHashes.set(normalizedRelPath, hashContent(rawContent));

      let content = rawContent;

      if (shouldApplyTemplateInterpolation(normalizedRelPath)) {
        content = content
          .replace(/{{project-name}}/g, config.name)
          .replace(/{{description}}/g, config.description || "");
      }

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

function shouldApplyTemplateInterpolation(relativePath: string): boolean {
  const normalizedPath = relativePath.replaceAll("\\", "/");
  if (normalizedPath.startsWith("packages/cli/")) {
    return false;
  }

  return true;
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

const ORIGIN_EXCLUDED_SEGMENTS = new Set([
  ".git",
  "node_modules",
  ".nx",
  "dist",
  ".beztack",
  ".beztack-sandbox",
  "pnpm-lock.yaml",
  "beztack.template.json",
  "beztack-sync-report.md",
]);

async function generateOrigin(
  projectDir: string,
  templateHashes: Map<string, string>
): Promise<void> {
  const files: Record<string, OriginFileEntry> = {};
  const pending = [projectDir];

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) continue;

    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const absPath = join(current, entry.name);
      const relPath = relative(projectDir, absPath).replaceAll("\\", "/");
      const firstSegment = relPath.split("/")[0] ?? relPath;

      if (ORIGIN_EXCLUDED_SEGMENTS.has(firstSegment) || ORIGIN_EXCLUDED_SEGMENTS.has(entry.name)) {
        continue;
      }

      if (entry.isDirectory()) {
        pending.push(absPath);
        continue;
      }

      if (entry.isFile()) {
        const content = await readFile(absPath, "utf-8");
        files[relPath] = {
          projectHash: hashContent(content),
          templateHash: templateHashes.get(relPath) ?? hashContent(content),
        };
      }
    }
  }

  const origin: Origin = {
    createdAt: new Date().toISOString(),
    files,
  };
  await writeOrigin(projectDir, origin);
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
    // Verify if commit actually succeeded despite the error
    try {
      await execAsync("git rev-parse HEAD", { cwd: projectDir });
      // Commit succeeded, ignore the error (likely just verbose output)
    } catch {
      // Commit truly failed
      if (commitError instanceof Error) {
        process.stderr.write(`Commit error: ${commitError.message}\n`);
      }
      throw commitError;
    }
  }
}
