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
import type { CreateProjectOptions } from "./create.js";
import { parseDebugFlag, setDebugMode } from "./debug.js";
import { initProject } from "./init-project.js";
import { modules } from "./modules.js";
import { runTemplateCommand } from "./template-sync/index.js";
import { getWorkspaceRoot } from "./utils/workspace.js";

type CommandDefinition = {
  name: string;
  description: string;
  aliases?: readonly string[];
  run: (args: string[]) => void | Promise<void>;
};

const COMMAND_DEFINITIONS: CommandDefinition[] = [
  {
    name: "create",
    description: "Create a new Beztack project",
    run: (args) => create(args),
  },
  {
    name: "init",
    description: "Configure modules in an existing project",
    run: () => main(),
  },
  {
    name: "template",
    description: "Manage template synchronization",
    run: (args) =>
      runTemplateCommand({
        workspaceRoot: getWorkspaceRoot(),
        args,
      }),
  },
  {
    name: "help",
    description: "Show this help message",
    aliases: ["--help", "-h"],
    run: () => showHelp(),
  },
];

const commandMap = new Map<string, CommandDefinition>();

for (const definition of COMMAND_DEFINITIONS) {
  commandMap.set(definition.name, definition);

  for (const alias of definition.aliases || []) {
    commandMap.set(alias, definition);
  }
}

function getCommandHelpLines() {
  const lines: string[] = [];

  for (const definition of COMMAND_DEFINITIONS) {
    const aliases = definition.aliases?.length
      ? ` (${definition.aliases.join(", ")})`
      : "";

    lines.push(
      `  ${definition.name.padEnd(9)}${definition.description}${aliases}`
    );
  }

  return lines.join("\n");
}

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
async function create(args: string[]) {
  const createOptions = parseCreateCommandOptions(args);
  //process.stdout.write("\x1Bc"); // Clear terminal
  intro("🚀 Welcome to Beztack - A Modern NX Monorepo Starter");

  try {
    await createProject(createOptions);
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
${getCommandHelpLines()}

${pc.bold("Options:")}
  -d, --debug    Show command outputs for debugging
  --refresh      Force template cache refresh before template commands
  --offline      Use only local template cache for template commands
  --host <host>  Host for "template inspect" server (default: 127.0.0.1)
  --port <port>  Port for "template inspect" server (default: 3434)

${pc.bold("Create Flags:")}
  --yes, --non-interactive       Run create without prompts
  --name <project-name>          Set project name
  --description <text>           Set project description
  --git | --no-git               Enable/disable git init
  --install | --no-install       Enable/disable dependency install
  --init | --no-init             Enable/disable module configuration
  --template-source <path-or-url>  Custom template source

${pc.bold("Examples:")}
  pnpm dlx beztack create
  pnpm dlx beztack create --yes --name my-app --no-install --no-git
  pnpm dlx beztack create --yes --name my-app --template-source ../beztack
  beztack init
  beztack template status
  beztack template status --offline
  beztack template plan --to 1.2.0
  beztack template apply --dry-run --refresh
  beztack template inspect --port 3434
`);
}

function parseCreateCommandOptions(
  args: string[]
): CreateProjectOptions {
  const options: CreateProjectOptions = {};
  let hasCreateFlags = false;
  let yesMode = false;

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unknown create argument: ${token}`);
    }

    hasCreateFlags = true;

    if (token === "--yes" || token === "--non-interactive") {
      yesMode = true;
      options.nonInteractive = true;
      continue;
    }

    if (
      token === "--name" ||
      token === "--description" ||
      token === "--template-source"
    ) {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`Missing value for ${token}`);
      }

      if (token === "--name") {
        options.name = value;
      } else if (token === "--template-source") {
        options.templateSource = value;
      } else {
        options.description = value;
      }

      index += 1;
      continue;
    }

    if (token === "--git") {
      options.initializeGit = true;
      continue;
    }
    if (token === "--no-git") {
      options.initializeGit = false;
      continue;
    }
    if (token === "--install") {
      options.installDependencies = true;
      continue;
    }
    if (token === "--no-install") {
      options.installDependencies = false;
      continue;
    }
    if (token === "--init") {
      options.initializeModules = true;
      continue;
    }
    if (token === "--no-init") {
      options.initializeModules = false;
      continue;
    }

    throw new Error(`Unknown create option: ${token}`);
  }

  if (
    hasCreateFlags &&
    options.nonInteractive !== true
  ) {
    options.nonInteractive = true;
  }

  if (options.nonInteractive === true && !options.name && !yesMode) {
    throw new Error(
      'Missing project name for non-interactive create. Use "--name <project-name>" or "--yes".'
    );
  }

  return options;
}

// Only run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  // Parse debug flag before anything else
  if (parseDebugFlag()) {
    setDebugMode(true);
    process.stdout.write(pc.dim("[DEBUG] Debug mode enabled\n"));
  }

  const rawArgs = process.argv.slice(2);
  const args = rawArgs.filter(
    (arg) => arg !== "--debug" && arg !== "-d"
  );
  const commandToken = args[0] || "create";
  const commandDefinition = commandMap.get(commandToken);

  if (!commandDefinition) {
    process.stderr.write(
      `${pc.red("Unknown command:")} ${commandToken}\n`
    );
    showHelp();
    process.exit(1);
  }

  const commandArgs = args.slice(1);

  Promise.resolve(commandDefinition.run(commandArgs)).catch((e: unknown) => {
    const message = e instanceof Error ? e.message : String(e);
    process.stderr.write(`${pc.red("Fatal error:")} ${message}\n`);
    process.exit(1);
  });
}
