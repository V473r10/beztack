#!/usr/bin/env node

import {
  cancel,
  intro,
  isCancel,
  multiselect,
  outro,
  spinner,
} from "@clack/prompts";
import pc from "picocolors";
import { createProject } from "./create.js";
import { parseDebugFlag, setDebugMode } from "./debug.js";
import { initProject } from "./init-project.js";
import { modules } from "./modules.js";

/**
 * Initialize modules in an existing project
 */
export async function main() {
  intro(pc.bgCyan(pc.black(" Beztack Init ")));

  const optionalModules = modules.filter((m) => !m.required);

  if (optionalModules.length === 0) {
    outro(
      pc.green(
        "No optional modules available. All required modules are included."
      )
    );
    process.exit(0);
  }

  const selected = await multiselect({
    message: "Select the modules you want to include:",
    options: optionalModules.map((m) => ({
      value: m.name,
      label: m.label,
      hint: m.description,
    })),
    required: false,
  });

  if (isCancel(selected)) {
    cancel("Operation cancelled.");
    process.exit(0);
  }

  const enabledModuleNames = [
    ...modules.filter((m) => m.required).map((m) => m.name),
    ...(selected as string[]),
  ];

  const s = spinner();
  s.start("Configuring modules...");

  try {
    await initProject(enabledModuleNames);
    s.stop("Modules configured.");
  } catch (err) {
    s.stop("Failed to configure modules.");
    if (err instanceof Error) {
      process.stderr.write(
        `${pc.red("Error:")} ${err.message}\n${pc.dim(err.stack || "")}\n`
      );
    } else {
      process.stderr.write(`${pc.red("Error:")} ${String(err)}\n`);
    }
    process.exit(1);
  }

  outro(pc.green("Done!"));
}

/**
 * Create a new Beztack project
 */
async function create() {
  process.stdout.write("\x1Bc"); // Clear terminal
  intro("🚀 Welcome to Beztack - A Modern NX Monorepo Starter");

  try {
    await createProject();
    outro("🎉 Project created successfully!");
  } catch (error) {
    cancel(error instanceof Error ? error.message : "Operation cancelled");
    process.exit(1);
  }
}

function showHelp() {
  process.stdout.write(`
${pc.bold("Beztack CLI")} - Modern NX Monorepo Starter

${pc.bold("Usage:")}
  beztack <command>

${pc.bold("Commands:")}
  create    Create a new Beztack project
  init      Configure modules in an existing project
  help      Show this help message

${pc.bold("Options:")}
  -d, --debug    Show command outputs for debugging

${pc.bold("Examples:")}
  pnpm dlx beztack create
  beztack init
`);
}

// Only run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  // Parse debug flag before anything else
  if (parseDebugFlag()) {
    setDebugMode(true);
    process.stdout.write(pc.dim("[DEBUG] Debug mode enabled\n"));
  }

  const command =
    process.argv.find(
      (arg) =>
        !arg.startsWith("-") &&
        arg !== process.argv[0] &&
        arg !== process.argv[1]
    ) || "create";

  switch (command) {
    case "create":
      create().catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e);
        process.stderr.write(`${pc.red("Fatal error:")} ${message}\n`);
        process.exit(1);
      });
      break;
    case "init":
      main().catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e);
        process.stderr.write(`${pc.red("Fatal error:")} ${message}\n`);
        process.exit(1);
      });
      break;
    case "help":
    case "--help":
    case "-h":
      showHelp();
      break;
    default:
      process.stderr.write(`${pc.red("Unknown command:")} ${command}\n`);
      showHelp();
      process.exit(1);
  }
}
