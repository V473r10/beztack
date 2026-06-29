/**
 * Beztack API routing harness — Derived project copy.
 *
 * Mixed ownership via two Sync seams. The Template source owns the
 * harness and the registration functions; the Derived project owns the
 * route registrations inside the seams.
 *
 * On a Template update from v1.1.0 to v1.2.0 the harness is rewritten
 * but both seam blocks below MUST be preserved verbatim by the Sync
 * engine.
 *
 *   - `api-route-registration` (issue #31): general platform routes.
 *   - `product-route-registration` (issue #35): Product domain routes.
 */

import type { IncomingMessage, ServerResponse } from "node:http";

export type RouteHandler = (
  req: IncomingMessage,
  res: ServerResponse
) => void | Promise<void>;

const routes = new Map<string, RouteHandler>();
const productRoutes = new Map<string, RouteHandler>();

/**
 * Sync seam: api-route-registration.
 *
 * Derived projects register custom routes here. The Template source never
 * edits the contents of this seam; it only updates the harness around it.
 * Engine policy MUST preserve every `registerRoute(...)` call made by the
 * Derived project during a Template update.
 */
export function registerRoute(path: string, handler: RouteHandler): void {
  routes.set(path, handler);
}

/**
 * Sync seam: product-route-registration.
 *
 * Derived projects register Product domain routes (checkout, catalogue,
 * etc.) here. The Template source never edits the contents of this seam.
 * Engine policy MUST preserve every `registerProductRoute(...)` call made
 * by the Derived project during a Template update.
 */
export function registerProductRoute(
  path: string,
  handler: RouteHandler
): void {
  productRoutes.set(path, handler);
}

export function dispatch(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const url = req.url ?? "/";
  const productHandler = productRoutes.get(url);
  if (productHandler) {
    return Promise.resolve(productHandler(req, res));
  }
  const handler = routes.get(url);
  if (!handler) {
    res.statusCode = 404;
    res.end("Not Found");
    return Promise.resolve();
  }
  return Promise.resolve(handler(req, res));
}

export const __templateVersion = "1.1.0";

/* ── api-route-registration seam — DO NOT EDIT FROM TEMPLATE SOURCE ── */
registerRoute("/health", (_req, res) => {
  res.statusCode = 200;
  res.end("ok");
});

registerRoute("/api/products/:id", (req, res) => {
  res.statusCode = 200;
  res.end(JSON.stringify({ id: req.url?.split("/").pop() ?? "" }));
});
/* ── end api-route-registration seam ── */

/* ── product-route-registration seam — DO NOT EDIT FROM TEMPLATE SOURCE ── */
registerProductRoute("/api/checkout/start", (_req, res) => {
  res.statusCode = 200;
  res.end(JSON.stringify({ status: "checkout-started" }));
});

registerProductRoute("/api/checkout/complete", (_req, res) => {
  res.statusCode = 200;
  res.end(JSON.stringify({ status: "checkout-complete" }));
});
/* ── end product-route-registration seam ── */