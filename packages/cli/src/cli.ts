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
import { initProject } from "./init-project.js";
import { modules } from "./modules.js";

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

// Solo ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e: unknown) => {
    const message = e instanceof Error ? e.message : String(e);
    process.stderr.write(`${pc.red("Fatal error:")} ${message}\n`);
    process.exit(1);
  });
}
