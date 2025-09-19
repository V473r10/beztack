#!/usr/bin/env bun
import { exec } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { promisify } from "node:util";
import * as p from "@clack/prompts";

const execAsync = promisify(exec);

interface ProjectConfig {
	name: string;
	description: string;
	initializeGit: boolean;
	installDependencies: boolean;
}

async function main() {
	console.clear();

	p.intro("🚀 Welcome to Buncn - A Modern Bun Monorepo Starter");

	try {
		const config = await getProjectConfig();
		const projectDir = path.resolve(process.cwd(), config.name);

		await createProjectStructure(projectDir, config);
		if (config.installDependencies)
			await installDependencies(projectDir, config);
		if (config.initializeGit) await initializeGit(projectDir);

		p.outro("🎉 Project created successfully!");
		console.log("\nNext steps:");
		console.log(`  cd ${config.name}`);
		console.log("  bun run dev\n");
	} catch (error) {
		p.cancel(error instanceof Error ? error.message : "Operation cancelled");
		process.exit(1);
	}
}

async function getProjectConfig(): Promise<ProjectConfig> {
	const config = await p.group(
		{
			name: () =>
				p.text({
					message: "Project name:",
					placeholder: "my-buncn-app",
					validate: (value) => {
						if (!value) return "Project name is required";
						if (!/^[a-z0-9-]+$/.test(value)) {
							return "Project name must be lowercase with hyphens";
						}
					},
				}),
			description: () =>
				p.text({
					message: "Project description:",
					placeholder: "My awesome Buncn project",
				}),
			initializeGit: () =>
				p.confirm({
					message: "Initialize Git repository?",
					initialValue: true,
				}),
			installDependencies: () =>
				p.confirm({
					message: "Install dependencies?",
					initialValue: true,
				}),
		},
		{
			onCancel: () => {
				p.cancel("Operation cancelled");
				process.exit(0);
			},
		},
	);

	return config as ProjectConfig;
}

async function createProjectStructure(
	projectDir: string,
	config: ProjectConfig,
) {
	const templateRepoUrl = "https://github.com/V473r10/buncn.git";
	let tempDir = "";
	const spinner = p.spinner();
	spinner.start("Creating project structure");

	try {
		// Create project directory
		await fs.mkdir(projectDir, { recursive: true });

		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "buncn-template-"));
		spinner.message(`Cloning template from ${templateRepoUrl}...`);
		await execAsync(`git clone --depth 1 ${templateRepoUrl} ${tempDir}`);
		spinner.message("Copying project files...");

		// Define exclusions relative to the root of the cloned template
		// Add any other files/dirs from your repo's root that shouldn't be in new projects
		const excludeDirs = [
			".git",
			"node_modules",
			"scripts/create-buncn",
			".github" /* e.g., 'docs' */,
		];

		await copyDir(tempDir, projectDir, excludeDirs, config);

		// Update package.json with project info
		const packageJsonPath = path.join(projectDir, "package.json");
		const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf-8"));

		packageJson.name = config.name;
		packageJson.description = config.description || "";

		await fs.writeFile(
			packageJsonPath,
			`${JSON.stringify(packageJson, null, 2)}\n`,
			"utf-8",
		);

		spinner.stop("Project structure created");
	} catch (error) {
		spinner.stop("Failed to create project structure");
		throw error;
	} finally {
		if (tempDir) {
			await fs.rm(tempDir, { recursive: true, force: true });
		}
	}
}

async function copyDir(
	src: string,
	dest: string,
	excludeDirs: string[],
	config: ProjectConfig,
	relativePath = "",
) {
	const entries = await fs.readdir(src, { withFileTypes: true });

	for (const entry of entries) {
		const srcPath = path.join(src, entry.name);
		const destPath = path.join(dest, entry.name);
		const relativeEntryPath = path.join(relativePath, entry.name);

		// Skip excluded directories
		if (excludeDirs.some((dir) => relativeEntryPath.startsWith(dir))) {
			continue;
		}

		if (entry.isDirectory()) {
			await fs.mkdir(destPath, { recursive: true });
			await copyDir(srcPath, destPath, excludeDirs, config, relativeEntryPath);
		} else {
			// Process file content for template variables
			let content = await fs.readFile(srcPath, "utf-8");

			// Replace template variables
			content = content
				.replace(/{{project-name}}/g, config.name)
				.replace(/{{description}}/g, config.description || "");

			await fs.writeFile(destPath, content, "utf-8");
		}
	}
}

async function installDependencies(projectDir: string, config: ProjectConfig) {
	const spinner = p.spinner();
	spinner.start("Installing dependencies");

	try {
		// Remove create-buncn from workspaces if it exists
		const packageJsonPath = path.join(projectDir, "package.json");
		const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf-8"));

		if (packageJson.workspaces) {
			packageJson.workspaces = packageJson.workspaces.filter(
				(ws: string) => ws !== "packages/create-buncn",
			);

			if (packageJson.workspaces.length === 0) {
				packageJson.workspaces = undefined;
			}

			await fs.writeFile(
				packageJsonPath,
				`${JSON.stringify(packageJson, null, 2)}\n`,
				"utf-8",
			);
		}

		// Install dependencies
		await execAsync("bun install", { cwd: projectDir });
		spinner.stop("Dependencies installed");
	} catch (error) {
		spinner.stop("Failed to install dependencies");
		throw error;
	}
}

async function initializeGit(projectDir: string) {
	const spinner = p.spinner();
	spinner.start("Initializing Git repository");

	try {
		await execAsync("git init", { cwd: projectDir });
		await execAsync("git add .", { cwd: projectDir });
		try {
			await execAsync('git commit -m "Initial commit"', { cwd: projectDir });
		} catch (commitError) {
			// Check if commitError is an object and has stderr/stdout properties
			if (typeof commitError === "object" && commitError !== null) {
				const err = commitError as {
					stderr?: string;
					stdout?: string;
					message?: string;
				};
				if (err.stderr) {
					console.warn(`Commit stderr: ${err.stderr}`);
				}
				if (!err.stderr && !err.stdout && err.message) {
					console.warn(`Commit error: ${err.message}`);
				}
			} else if (commitError instanceof Error) {
				console.warn(`Commit error: ${commitError.message}`);
			}

			// Attempt to check if commit was actually made despite error
			try {
				await execAsync("git rev-parse HEAD", {
					cwd: projectDir,
				});
			} catch (checkError) {
				console.error(
					"Failed to verify commit. Git initialization might be incomplete.",
				);
				// Propagate the original commitError if verification also fails or is inconclusive
				throw commitError;
			}
		}
		spinner.stop("Git repository initialized");
	} catch (error) {
		spinner.stop("Failed to initialize Git repository");
		// Not critical, so we don't throw
		console.warn("  - Git initialization failed, continuing...");
		if (error instanceof Error && error.message) {
			console.warn(`  - Error details: ${error.message}`);
		}
	}
}

main().catch(console.error);
