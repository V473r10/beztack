import type { TFunction } from "i18next";
import { ApiError } from "./api-client";

const ORGANIZATION_REQUIRED = "organization_required";
const GENERIC_REQUEST_FAILED = "Request failed";
const CONFLICT = 409;
const TOO_MANY_REQUESTS = 429;
const CLIENT_ERROR_MIN = 400;
const SERVER_ERROR_MIN = 500;
const MAX_QUERY_RETRIES = 2;

function readErrorCode(error: unknown): string | undefined {
  if (!(error instanceof ApiError)) {
    return;
  }
  const { data } = error;
  if (data && typeof data === "object" && "code" in data) {
    const { code } = data as { code?: unknown };
    return typeof code === "string" ? code : undefined;
  }
  return;
}

/** The API answered 409 `organization_required`: billing needs an organization. */
export function isOrganizationRequiredError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.statusCode === CONFLICT &&
    readErrorCode(error) === ORGANIZATION_REQUIRED
  );
}

/** The API answered 429: the Payment provider (or the API itself) is rate-limiting. */
export function isProviderRateLimitedError(error: unknown): boolean {
  return error instanceof ApiError && error.statusCode === TOO_MANY_REQUESTS;
}

/**
 * Retry policy of the billing queries. A 4xx answer is final and a 429 is the
 * rate limit itself, so retrying it only keeps the page loading and adds
 * requests; a server or network failure gets two more tries.
 */
export function shouldRetryBillingQuery(failureCount: number, error: unknown): boolean {
  if (
    error instanceof ApiError &&
    error.statusCode >= CLIENT_ERROR_MIN &&
    error.statusCode < SERVER_ERROR_MIN
  ) {
    return false;
  }
  return failureCount < MAX_QUERY_RETRIES;
}

/**
 * The message to show for a failed billing request: the translation of the
 * server's error code when there is one, else the server's own message, else
 * `fallback`.
 */
export function getBillingErrorMessage(t: TFunction, error: unknown, fallback: string): string {
  const code = readErrorCode(error);
  if (code) {
    const key = `billing.errors.${code}`;
    const translated = t(key, { defaultValue: "" });
    if (translated) {
      return translated;
    }
  }

  if (error instanceof Error && error.message && error.message !== GENERIC_REQUEST_FAILED) {
    return error.message;
  }

  return fallback;
}

/**
 * Runs a billing request. When the API says the caller has no organization,
 * asks for one (the "create organization" dialog) and retries once with the
 * new id. Resolves `undefined` when the caller declines to create one.
 */
export async function runWithOrganization<T>(
  run: (organizationId: string | undefined) => Promise<T>,
  organizationId: string | undefined,
  askForOrganization: () => Promise<string | null>,
): Promise<T | undefined> {
  try {
    return await run(organizationId);
  } catch (error) {
    if (!isOrganizationRequiredError(error)) {
      throw error;
    }
    const createdOrganizationId = await askForOrganization();
    if (!createdOrganizationId) {
      return;
    }
    return await run(createdOrganizationId);
  }
}
