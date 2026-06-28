/**
 * Derived project utility — proposed for Promotion.
 *
 * This file lives under packages/util/**, which the Derived project's
 * Sync policy classifies as template-owned (via packages/**). The Derived
 * project added this file in a PR labelled for Promotion consideration.
 *
 * Promotion metadata must list this file as a candidate because it sits on
 * a Template-owned path. Reviewers decide whether to accept it as a
 * Platform extraction or revert it.
 */

export async function retry<T>(
  operation: () => Promise<T>,
  attempts = 3,
  delayMs = 100
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
      }
    }
  }
  throw lastError;
}
