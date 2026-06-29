/**
 * Template source v1.1.0 — Beztack API routing harness.
 *
 * Mixed ownership. The Template source owns the routing harness and the
 * registration functions. Derived projects extend routing by adding calls
 * inside the Sync seams marked below. Do not edit the harness itself from
 * a Derived project.
 *
 * This revision introduces the `product-route-registration` seam alongside
 * the existing `api-route-registration` seam. The two seams separate
 * platform routes (issue #31) from Product domain routes (issue #35).
 * Both seams are preserved verbatim by the Sync engine during a Template
 * update.
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
 * Derived projects register generic routes here. The Template source
 * never edits the contents of this seam; it only updates the harness
 * around it. Engine policy MUST preserve every `registerRoute(...)`
 * call made by the Derived project during a Template update.
 */
export function registerRoute(path: string, handler: RouteHandler): void {
  routes.set(path, handler);
}

/**
 * Sync seam: product-route-registration.
 *
 * Derived projects register Product domain routes (e.g. checkout, product
 * catalogue) here. The Template source never edits the contents of this
 * seam. Engine policy MUST preserve every `registerProductRoute(...)`
 * call made by the Derived project during a Template update.
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