import { timingSafeEqual } from "node:crypto";
import { createError, getHeader, type H3Event } from "h3";

/** Name of the env var holding one scheduled job's secret, e.g. `CLEANUP_CRON_SECRET`. */
export type CronSecretName = `${string}_CRON_SECRET`;

const HTTP_UNAUTHORIZED = 401;
const HTTP_SERVICE_UNAVAILABLE = 503;
const BEARER_PREFIX = "Bearer ";

function readPresentedSecret(event: H3Event): string | undefined {
  const header = getHeader(event, "x-cron-secret");
  if (header) {
    return header;
  }

  const authorization = getHeader(event, "authorization");
  if (authorization?.startsWith(BEARER_PREFIX)) {
    return authorization.slice(BEARER_PREFIX.length);
  }

  return undefined;
}

function secretsMatch(presented: string, configured: string): boolean {
  const presentedBytes = Buffer.from(presented);
  const configuredBytes = Buffer.from(configured);
  if (presentedBytes.length !== configuredBytes.length) {
    return false;
  }
  return timingSafeEqual(presentedBytes, configuredBytes);
}

/**
 * Authentication for scheduled ("cron") routes.
 *
 * The API runs serverless, so every scheduled job is an HTTP route an external
 * scheduler invokes. Each job has its own `<NAME>_CRON_SECRET`, so leaking one
 * job's secret never unlocks another. Ported from lncd's `cron-request.ts`.
 *
 * The caller sends the secret in `x-cron-secret` or as `Authorization: Bearer`.
 * The secret is read at call time, so the format checks in `@beztack/env/api`
 * apply at startup and a deployment can enable a job by setting its secret.
 *
 * - Secret unset -> 503: the job is deliberately disabled for this deployment.
 * - Secret missing or wrong -> 401.
 */
export function requireCronSecret(event: H3Event, secretName: CronSecretName): void {
  const configured = process.env[secretName];
  if (!configured) {
    throw createError({
      statusCode: HTTP_SERVICE_UNAVAILABLE,
      statusMessage: `Cron job disabled: ${secretName} is not set`,
    });
  }

  const presented = readPresentedSecret(event);
  if (!(presented && secretsMatch(presented, configured))) {
    throw createError({ statusCode: HTTP_UNAUTHORIZED, statusMessage: "Unauthorized" });
  }
}
