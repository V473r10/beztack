import { hasAuthRole } from "@beztack/auth";

/**
 * App admin: the one place that decides who operates the platform.
 *
 * An App admin needs BOTH the `sudo` App role AND an email in the
 * `APP_ADMIN_EMAILS` allowlist. The role alone is not enough: a stale or
 * hand-edited `sudo` without the allowlist entry grants nothing. Being an App
 * admin gives no Organization role.
 *
 * Pure on purpose (no env read): callers pass the allowlist, so the rule is
 * testable and shared by better-auth's hooks and the API routes.
 */

export type AppAdminActor = {
  email?: string | null;
  role?: unknown;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Parse the comma-separated `APP_ADMIN_EMAILS` value into normalized emails. */
export function parseAppAdminEmails(value: string): string[] {
  return value.split(",").map(normalizeEmail).filter(Boolean);
}

/** Whether `email` is on the allowlist (case- and whitespace-insensitive). */
export function isAllowlistedAppAdminEmail(
  email: string | null | undefined,
  appAdminEmails: string[],
): boolean {
  if (!email) {
    return false;
  }
  return appAdminEmails.map(normalizeEmail).includes(normalizeEmail(email));
}

/** `sudo` App role AND an allowlisted email. */
export function isAppAdminActor(actor: AppAdminActor, appAdminEmails: string[]): boolean {
  return hasAuthRole(actor.role, "sudo") && isAllowlistedAppAdminEmail(actor.email, appAdminEmails);
}
