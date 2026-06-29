/**
 * Template source v1.1.0 — Beztack product-module harness.
 *
 * Mixed ownership. The Template source owns the module-registration
 * framework (the `registerProductModule` function and the
 * `runProductModules` executor). Derived projects extend the framework by
 * registering Product domain modules inside the Sync seam marked below.
 * Do not edit the harness itself from a Derived project.
 *
 * This file ships in v1.1.0 alongside `apps/api/routes.ts` and exists
 * specifically to give Product domains a stable extension point for
 * request-handling modules without editing Template-owned wiring directly
 * (issue #35 — Sync seams for lncd routing and module wiring drift).
 */

import type { IncomingMessage, ServerResponse } from "node:http";

export type ProductModule = (
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void
) => void | Promise<void>;

const chain: ProductModule[] = [];

/**
 * Sync seam: product-module-registration.
 *
 * Derived projects register Product domain modules here. The Template
 * source never edits the contents of this seam; it only updates the
 * harness around it. Engine policy MUST preserve every
 * `registerProductModule(...)` call made by the Derived project during
 * a Template update.
 */
export function registerProductModule(module: ProductModule): void {
  chain.push(module);
}

export async function runProductModules(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  let index = 0;
  const next = (): void => {
    const step = chain[index++];
    if (!step) {
      return;
    }
    const result = step(req, res, next);
    if (result && typeof (result as Promise<void>).then === "function") {
      result.catch((err: unknown) => {
        // Engine surfaces module failures through `res`; the harness does
        // not crash the request chain on its own.
        // eslint-disable-next-line no-console
        console.error("[product-module] rejected", err);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end("Product module failure");
        }
      });
    }
  };
  next();
  await new Promise((resolve) => setImmediate(resolve));
}

export const __templateVersion = "1.1.0";