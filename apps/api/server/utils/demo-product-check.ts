/**
 * Checks that the provider products named by the demo env exist and are the
 * tier and cadence the variable says (docs/demo.md). A stale or mis-copied id
 * otherwise seeds fine and shows up later as empty pricing cards and a 400 at
 * checkout.
 *
 * Reads no env and opens no connection: the caller hands in the adapter and the
 * variables. Messages carry the variable name, the product id and the expected
 * tier and cadence. Never a credential, and never the provider's own error text.
 */
import type { PaymentProviderAdapter } from "@beztack/payments";

export type DemoProductRef = {
  /** Env variable that holds the id, so the error can say which one to fix. */
  variable: string;
  productId: string;
  tier: string;
  interval: "month" | "year";
};

export type DemoProductProblem = {
  variable: string;
  productId: string;
  reason: string;
};

export type DemoProductLookup = Pick<PaymentProviderAdapter, "getProduct">;

const POLAR_PRODUCT_VARIABLES = [
  { variable: "POLAR_BASIC_MONTHLY_PRODUCT_ID", tier: "basic", interval: "month" },
  { variable: "POLAR_BASIC_YEARLY_PRODUCT_ID", tier: "basic", interval: "year" },
  { variable: "POLAR_PRO_MONTHLY_PRODUCT_ID", tier: "pro", interval: "month" },
  { variable: "POLAR_PRO_YEARLY_PRODUCT_ID", tier: "pro", interval: "year" },
  { variable: "POLAR_ULTIMATE_MONTHLY_PRODUCT_ID", tier: "ultimate", interval: "month" },
  { variable: "POLAR_ULTIMATE_YEARLY_PRODUCT_ID", tier: "ultimate", interval: "year" },
] as const;

/**
 * The products to check for a provider. Mercado Pago has none: its plan ids are
 * created by plan sync, not configured by hand.
 */
export function demoProductsFor(provider: string, env: Record<string, unknown>): DemoProductRef[] {
  if (provider !== "polar") {
    return [];
  }
  return POLAR_PRODUCT_VARIABLES.map((entry) => {
    const value = env[entry.variable];
    return { ...entry, productId: typeof value === "string" ? value : "" };
  });
}

async function checkProduct(
  provider: DemoProductLookup,
  ref: DemoProductRef,
): Promise<DemoProductProblem | null> {
  const { variable, productId } = ref;
  if (!productId) {
    return { variable, productId, reason: "is not set" };
  }

  let found: Awaited<ReturnType<DemoProductLookup["getProduct"]>>;
  try {
    found = await provider.getProduct(productId);
  } catch {
    return { variable, productId, reason: "could not be fetched from the provider" };
  }
  if (!found) {
    return {
      variable,
      productId,
      reason: "not found in the provider (an old or mis-copied id, or another account)",
    };
  }

  const tier = found.metadata?.tier;
  if (typeof tier !== "string" || tier === "") {
    return {
      variable,
      productId,
      reason: `has no metadata.tier; add tier="${ref.tier}" to the product`,
    };
  }
  if (tier !== ref.tier) {
    return { variable, productId, reason: `has tier "${tier}", expected "${ref.tier}"` };
  }
  if (found.interval !== ref.interval) {
    return {
      variable,
      productId,
      reason: `bills every "${found.interval}", expected "${ref.interval}"`,
    };
  }
  return null;
}

/** Every product that is missing or does not match; empty when all is well. */
export async function verifyDemoProducts(
  provider: DemoProductLookup,
  refs: DemoProductRef[],
): Promise<DemoProductProblem[]> {
  const results = await Promise.all(refs.map((ref) => checkProduct(provider, ref)));
  return results.filter((problem): problem is DemoProductProblem => problem !== null);
}

export class DemoProductCheckError extends Error {
  readonly problems: DemoProductProblem[];

  constructor(problems: DemoProductProblem[]) {
    const lines = problems.map(
      ({ variable, productId, reason }) =>
        `  - ${variable}${productId ? ` (${productId})` : ""} ${reason}`,
    );
    super(
      `The payment provider does not match the demo configuration:\n${lines.join("\n")}\n` +
        'Fix these variables in apps/api/.env (see docs/demo.md, "Provider products").',
    );
    this.name = "DemoProductCheckError";
    this.problems = problems;
  }
}

/** Throws a `DemoProductCheckError` naming every variable that needs fixing. */
export async function assertDemoProducts(
  provider: DemoProductLookup,
  refs: DemoProductRef[],
): Promise<void> {
  const problems = await verifyDemoProducts(provider, refs);
  if (problems.length > 0) {
    throw new DemoProductCheckError(problems);
  }
}
