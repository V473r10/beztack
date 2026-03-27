/**
 * Polar Better Auth client plugin wrapper
 *
 * Wraps @polar-sh/better-auth/client so that apps/ui never imports Polar directly.
 */
import { polarClient } from "@polar-sh/better-auth/client";

/**
 * Create the Polar Better Auth client plugin.
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createPolarClientPlugin(): ReturnType<typeof polarClient> {
  return polarClient();
}
