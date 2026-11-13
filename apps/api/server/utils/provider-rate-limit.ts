import { createError } from "h3";

/**
 * The Payment provider answered 429 (too many requests). The UI answers this
 * code with a "try again in a moment" state instead of a generic failure.
 */
export const PROVIDER_RATE_LIMITED_CODE = "provider_rate_limited";

const TOO_MANY_REQUESTS = 429;

function readStatus(value: unknown): unknown {
  if (!value || typeof value !== "object") {
    return;
  }
  const record = value as { statusCode?: unknown; status?: unknown; response?: unknown };
  return record.statusCode ?? record.status ?? readStatus(record.response);
}

/** Whether an error thrown by a payment adapter is the provider's 429. */
export function isProviderRateLimited(error: unknown): boolean {
  return readStatus(error) === TOO_MANY_REQUESTS;
}

/**
 * Runs a provider call. A provider 429 becomes a 429 of ours carrying
 * `provider_rate_limited`; any other error passes through untouched.
 */
export async function withProviderRateLimit<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (!isProviderRateLimited(error)) {
      throw error;
    }
    throw createError({
      statusCode: TOO_MANY_REQUESTS,
      statusMessage: "The payment provider is busy. Try again in a moment.",
      data: { code: PROVIDER_RATE_LIMITED_CODE },
      cause: error,
    });
  }
}
