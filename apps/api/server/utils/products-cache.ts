/**
 * A short, in-process cache for the public Products response.
 *
 * Every page load asks the Payment provider for its products, and the sandbox
 * answers 429 when the visitor navigates fast. The response is the same for
 * every caller (it carries no per-user data), so one process-wide slot is
 * enough: concurrent reads share one load, and a result is served until its
 * TTL expires or an App admin changes the catalog (`invalidateProductsCache`).
 *
 * Never put per-user or per-organization data through this cache.
 */

/** How long a response built from the provider's products is served. */
export const PRODUCTS_CACHE_TTL_MS = 30_000;

/**
 * How long the Pricing catalog fallback is served after a provider failure.
 * Short, so the provider is retried soon, but long enough that a 429 is not
 * answered by hammering the provider on every request.
 */
export const PRODUCTS_FALLBACK_TTL_MS = 5000;

type Loaded<T> = { body: T; ttlMs: number };

type Entry = { body: unknown; expiresAt: number };

let entry: Entry | null = null;
let inFlight: Promise<unknown> | null = null;
// Bumped by every invalidation, so a load that started before it is not stored.
let generation = 0;

export function invalidateProductsCache(): void {
  entry = null;
  inFlight = null;
  generation += 1;
}

export function readThroughProductsCache<T>(load: () => Promise<Loaded<T>>): Promise<T> {
  if (entry && entry.expiresAt > Date.now()) {
    return Promise.resolve(entry.body as T);
  }

  if (inFlight) {
    return inFlight as Promise<T>;
  }

  const startedAt = generation;
  const pending = load()
    .then((loaded) => {
      if (startedAt === generation) {
        entry = { body: loaded.body, expiresAt: Date.now() + loaded.ttlMs };
      }
      return loaded.body;
    })
    .finally(() => {
      if (inFlight === pending) {
        inFlight = null;
      }
    });
  inFlight = pending;

  return pending;
}
