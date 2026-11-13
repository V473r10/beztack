/**
 * Verifies the demo's provider products without writing anything (docs/demo.md).
 *
 *   pnpm demo:check
 *
 * Asks the active payment provider for each configured product and exits 1,
 * naming the variable, if one is missing or is not the expected tier and
 * cadence. Touches no database. `demo:seed` runs the same check first.
 */
import "dotenv/config";
import { env } from "@beztack/env/api";
import { checkDemoProviderProducts } from "./demo-provider-check";

function log(message: string): void {
  // biome-ignore lint/suspicious/noConsole: CLI script
  console.info(`[demo-check] ${message}`);
}

async function main(): Promise<void> {
  if (!env.DEMO_MODE) {
    throw new Error("DEMO_MODE=true is required: this check is only for the demo deployment");
  }
  const checked = await checkDemoProviderProducts(log);
  log(`Provider products match (${checked} checked)`);
}

main().catch((error: unknown) => {
  // biome-ignore lint/suspicious/noConsole: CLI script
  console.error("[demo-check]", error instanceof Error ? error.message : "check failed");
  process.exit(1);
});
