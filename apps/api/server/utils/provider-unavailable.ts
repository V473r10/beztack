import { createError } from "h3";

/**
 * The Payment provider could not answer (rate limit, outage, timeout) and
 * nothing local can stand in for it. The UI answers this code with a retry
 * state instead of a plan it does not know.
 */
export const PROVIDER_UNAVAILABLE_CODE = "provider_unavailable";

const SERVICE_UNAVAILABLE = 503;

/** A 503 of ours carrying `provider_unavailable`; `cause` is the provider's error. */
export function providerUnavailableError(cause?: unknown) {
  return createError({
    statusCode: SERVICE_UNAVAILABLE,
    statusMessage: "The payment provider is unavailable. Try again in a moment.",
    data: { code: PROVIDER_UNAVAILABLE_CODE },
    cause,
  });
}

/** Whether an error is the one `providerUnavailableError` builds. */
export function isProviderUnavailableError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const { data } = error as { data?: unknown };
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { code?: unknown }).code === PROVIDER_UNAVAILABLE_CODE
  );
}
