import type { TFunction } from "i18next";
import { ApiError } from "./api-client";

const ORGANIZATION_REQUIRED = "organization_required";
const GENERIC_REQUEST_FAILED = "Request failed";
const CONFLICT = 409;

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
