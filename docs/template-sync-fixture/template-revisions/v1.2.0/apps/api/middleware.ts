/**
 * Template source v1.2.0 — default middleware.
 *
 * Mixed ownership. The Template source owns the framework default; Derived
 * projects add custom middleware in the Sync seam below. There is no Sync
 * seam registered in the fixture policy for this file in v1.1.0, which means
 * the engine MUST report this file as a Sync conflict if the Derived project
 * already has its own version of it (it does — see derived-project/apps/api/middleware.ts).
 */

import type { IncomingMessage, ServerResponse } from "node:http";

export type Middleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void
) => void;

const chain: Middleware[] = [];

export function use(middleware: Middleware): void {
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

export const __templateVersion = "1.2.0";
