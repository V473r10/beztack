import { createError } from "h3";

/**
 * The caller has no organization to act for. Billing in `organization`
 * subscription mode needs one, so the UI answers this code by opening its
 * "create organization" dialog and retrying with the new id.
 */
export const ORGANIZATION_REQUIRED_CODE = "organization_required";

export function organizationRequiredError() {
  return createError({
    statusCode: 409,
    statusMessage: "Create an organization first: this action bills an organization.",
    data: { code: ORGANIZATION_REQUIRED_CODE },
  });
}
