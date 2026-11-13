/**
 * Shared by `seed-demo.mts` and `check-demo.mts`: asks the active payment
 * provider for every product the demo env names (docs/demo.md). Read-only. Never
 * prints a credential: only variable names, product ids and the mismatch.
 */
import { env } from "@beztack/env/api";
import { ensurePaymentProvider } from "../lib/payments";
import { assertDemoProducts, demoProductsFor } from "../server/utils/demo-product-check";

/** Throws `DemoProductCheckError` naming each variable that is wrong. Returns how many products matched. */
export async function checkDemoProviderProducts(log: (message: string) => void): Promise<number> {
  const refs = demoProductsFor(env.PAYMENT_PROVIDER, env);
  if (refs.length === 0) {
    log(`No provider products to check for ${env.PAYMENT_PROVIDER} (plan ids come from plan sync)`);
    return 0;
  }

  const provider = await ensurePaymentProvider();
  await assertDemoProducts(provider, refs);
  for (const ref of refs) {
    log(`${ref.variable} ok (${ref.tier}, ${ref.interval})`);
  }
  return refs.length;
}
