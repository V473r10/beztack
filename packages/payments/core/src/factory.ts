/**
 * Payment Provider Factory
 *
 * Registry-based factory with dynamic imports.
 * Each provider registers a lazy loader — only the active provider is imported at runtime.
 *
 * CLI codemods: to remove a provider, delete its `registry.set(...)` line
 * and remove the package from the workspace.
 */
import type {
  PaymentProviderAdapter,
  PaymentProviderName,
  ProviderAdapterFactory,
} from "./types.js";

type LazyFactory = () => Promise<ProviderAdapterFactory>;

const registry = new Map<PaymentProviderName, LazyFactory>();

// --- Provider registrations (codemod boundary) ---
// Dynamic imports are untyped to avoid circular build dependencies.
// Each provider package exports a `createAdapter` function at runtime.
registry.set("polar", async () => {
  const mod = (await import("@beztack/payments-polar" as string)) as {
    createAdapter: ProviderAdapterFactory;
  };
  return mod.createAdapter;
});
registry.set("mercadopago", async () => {
  const mod = (await import("@beztack/mercadopago" as string)) as {
    createAdapter: ProviderAdapterFactory;
  };
  return mod.createAdapter;
});
// --- End provider registrations ---

let cachedAdapter: PaymentProviderAdapter | null = null;
let cachedProviderName: PaymentProviderName | null = null;

/**
 * Create a payment provider adapter for the given provider name and config.
 * Results are cached — subsequent calls with the same provider return the same instance.
 */
export async function createPaymentProvider(
  provider: PaymentProviderName,
  config: Record<string, string>
): Promise<PaymentProviderAdapter> {
  if (cachedAdapter && cachedProviderName === provider) {
    return cachedAdapter;
  }

  const factory = registry.get(provider);
  if (!factory) {
    throw new Error(
      `Unknown payment provider: "${provider}". Available: ${[...registry.keys()].join(", ")}`
    );
  }

  const create = await factory();
  cachedAdapter = create(config);
  cachedProviderName = provider;

  return cachedAdapter;
}

/**
 * Synchronous getter for the cached adapter.
 * Throws if createPaymentProvider() hasn't been called yet.
 */
export function getPaymentProvider(): PaymentProviderAdapter {
  if (!cachedAdapter) {
    throw new Error(
      "Payment provider not initialized. Call createPaymentProvider() first."
    );
  }
  return cachedAdapter;
}

/**
 * Reset the cached adapter (useful for testing or config changes)
 */
export function resetPaymentProvider(): void {
  cachedAdapter = null;
  cachedProviderName = null;
}

/**
 * Get the list of registered provider names
 */
export function getRegisteredProviders(): PaymentProviderName[] {
  return [...registry.keys()];
}
