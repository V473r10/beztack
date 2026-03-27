import { exec as execCb } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { glob } from "glob";
import { regenerateEntrypoints } from "./generate-entrypoints.js";
import type { PaymentProvider } from "./modules.js";
import { modules } from "./modules.js";
import { removeModule } from "./remove-module.js";
import { getWorkspaceRoot } from "./utils/workspace.js";

const exec = promisify(execCb);

export interface InitProjectConfig {
  enabledModules: string[];
  paymentProvider?: PaymentProvider;
}

type ProviderPruneConfig = {
  fileGlobs: string[];
};

const PROVIDER_PRUNE_CONFIG: Record<PaymentProvider, ProviderPruneConfig> = {
  polar: {
    fileGlobs: ["apps/api/server/routes/api/payments/mercado-pago/**/*"],
  },
  mercadopago: {
    fileGlobs: ["apps/api/server/routes/api/polar/**/*"],
  },
};

function normalizeConfig(
  input: string[] | InitProjectConfig
): InitProjectConfig {
  if (Array.isArray(input)) {
    return {
      enabledModules: input,
    };
  }

  return input;
}

function getUniqueModules(moduleNames: string[]): string[] {
  return [...new Set(moduleNames)];
}

function shouldEnablePayments(moduleNames: string[]): boolean {
  return moduleNames.includes("payments");
}

function validatePaymentProvider(config: InitProjectConfig): void {
  if (shouldEnablePayments(config.enabledModules) && !config.paymentProvider) {
    throw new Error(
      "Payments module requires --payment-provider (polar or mercadopago)"
    );
  }
}

async function removeFilesByGlob(fileGlobs: string[]): Promise<void> {
  const workspaceRoot = getWorkspaceRoot();

  for (const pattern of fileGlobs) {
    const files = await glob(pattern, { cwd: workspaceRoot });
    for (const file of files) {
      await rm(join(workspaceRoot, file), {
        recursive: true,
        force: true,
      });
    }
  }
}

async function applyProviderPruning(
  paymentProvider: PaymentProvider
): Promise<void> {
  const pruneConfig = PROVIDER_PRUNE_CONFIG[paymentProvider];
  await removeFilesByGlob(pruneConfig.fileGlobs);
}

async function updateProviderInEnvExamples(
  paymentProvider: PaymentProvider
): Promise<void> {
  const workspaceRoot = getWorkspaceRoot();
  const envFiles = ["apps/api/.env.example", "apps/ui/.env.example"] as const;

  for (const envFile of envFiles) {
    const path = join(workspaceRoot, envFile);
    const original = await readFile(path, "utf-8");

    const updated = original
      .replace(/^PAYMENT_PROVIDER=.*$/m, `PAYMENT_PROVIDER=${paymentProvider}`)
      .replace(
        /^VITE_PAYMENT_PROVIDER=.*$/m,
        `VITE_PAYMENT_PROVIDER=${paymentProvider}`
      );

    if (updated !== original) {
      await writeFile(path, updated, "utf-8");
    }
  }
}

export async function initProject(input: string[] | InitProjectConfig) {
  const config = normalizeConfig(input);
  const enabledModuleNames = getUniqueModules(config.enabledModules);
  validatePaymentProvider(config);

  const allModules = modules;
  const enabledSet = new Set(enabledModuleNames);
  const disabled = allModules.filter((m) => !enabledSet.has(m.name));

  // 1. Remove disabled modules (skip pnpm install for each)
  for (const mod of disabled) {
    if (mod.required) {
      continue;
    }
    await removeModule(mod.name, { skipInstall: true });
  }

  // 2. If payments is enabled, prune non-selected provider routes and sync env examples
  if (shouldEnablePayments(enabledModuleNames) && config.paymentProvider) {
    await applyProviderPruning(config.paymentProvider);
    await updateProviderInEnvExamples(config.paymentProvider);
  }

  // 2. Regenerate entrypoints (routes, module index, etc.)
  await regenerateEntrypoints();

  // 3. Run a single pnpm install at the workspace root
  const workspaceRoot = getWorkspaceRoot();
  await exec("pnpm install", { cwd: workspaceRoot });
}
