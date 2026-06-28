/**
 * Derived project middleware — Product-domain implementation.
 *
 * Sync policy: mixed ownership. There is no Sync seam registered for this
 * file in the v1.1.0 policy, so the Template source v1.2.0 (which adds a
 * default middleware to the same path) cannot safely merge with this
 * Custom content.
 *
 * The Sync engine MUST report this file as a Sync conflict and refuse to
 * silently merge. A follow-up decision is required: refactor to a seam,
 * override the Template-owned default, or skip the update.
 */

import type { IncomingMessage, ServerResponse } from "node:http";

export type Middleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void
) => void;

const chain: Middleware[] = [];

// Derived project registers a request-timing middleware as a Product-domain
// concern. The Template source v1.2.0 adds its own default middleware to
// the same path, which would clobber this if merged.
use((req, _res, next) => {
  const start = Date.now();
  req.on("close", () => {
    // eslint-disable-next-line no-console
    console.log(`[derived-app] ${req.method} ${req.url} ${Date.now() - start}ms`);
  });
  next();
});

export function useMiddleware(middleware: Middleware): void {
  chain.push(middleware);
}

export async function runMiddleware(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  let index = 0;
  const next = (): void => {
    const step = chain[index++];
    if (!step) {
      return;
    }
    step(req, res, next);
  };
  next();
  await new Promise((resolve) => setImmediate(resolve));
}
