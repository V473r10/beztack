/**
 * Origins the API accepts cross-origin, credentialed requests from.
 *
 * Read from configuration only: the comma-separated `CORS_ORIGINS` plus the
 * origin of `APP_URL` (the UI is always allowed to call its own API). Deploying
 * to a new domain is an env change, never a code change.
 */
export function resolveAllowedOrigins(config: { corsOrigins: string; appUrl: string }): string[] {
  const configured = config.corsOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => new URL(origin).origin);

  return [...new Set([new URL(config.appUrl).origin, ...configured])];
}
