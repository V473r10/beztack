#!/usr/bin/env node

/**
 * create-beztack - Proxy to beztack CLI
 *
 * This script is a simple proxy that forwards to the beztack CLI.
 * All logic lives in the beztack package (packages/cli).
 *
 * Usage:
 *   pnpm create beztack    -> runs `pnpm dlx beztack create`
 *   Development mode       -> runs local compiled CLI
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Detect if we're running in development mode (from the monorepo source)
 */
function isDevMode(): boolean {
  const monorepoCliPath = resolve(
    __dirname,
    "../../../packages/cli/dist/cli.js"
  );
  return existsSync(monorepoCliPath);
}

/**
 * Get the command to run the beztack CLI
 * Development: use local compiled CLI
 * Production: use pnpm dlx to run from npm registry
 */
function getBeztackCommand(): { command: string; args: string[] } {
  if (isDevMode()) {
    const cliPath = resolve(__dirname, "../../../packages/cli/dist/cli.js");
    return { command: "node", args: [cliPath, "create"] };
  }
  // Production: run from npm registry
  return { command: "pnpm", args: ["dlx", "beztack", "create"] };
}

function main() {
  const { command, args } = getBeztackCommand();

  const result = spawnSync(command, args, {
    stdio: "inherit",
    cwd: process.cwd(),
  });

  process.exit(result.status ?? 1);
}

main();
