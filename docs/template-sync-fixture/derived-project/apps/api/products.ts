/**
 * Derived project copy — Beztack product-module harness.
 *
 * Mixed ownership via the `product-module-registration` Sync seam.
 * The Template source owns the registration framework (the
 * `registerProductModule` function and the `runProductModules` executor);
 * the Derived project owns the module registrations inside the seam.
 *
 * On a Template update from v1.1.0 to v1.2.0 the harness is rewritten
 * but the seam block below MUST be preserved verbatim by the Sync engine.
 *
 * (issue #35 — Sync seams for lncd routing and module wiring drift.)
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

/* ── product-module-registration seam — DO NOT EDIT FROM TEMPLATE SOURCE ── */
// Derived project registers Product-domain request modules here. The
// Template source v1.2.0 adds `moduleCount()` to the harness but does
// not edit this seam region.
registerProductModule((_req, _res, next) => {
  // Product-domain audit log: track each request without modifying the
  // harness.
  next();
});

registerProductModule((req, _res, next) => {
  // Derived project product feature flag: pretend to evaluate a flag for
  // the request. Demonstrates that Derived projects can register multiple
  // modules without editing Template-owned wiring.
  void req.headers["x-product-feature"];
  next();
});
/* ── end product-module-registration seam ── */