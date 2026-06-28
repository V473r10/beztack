/**
 * Template source v1.1.0 — Beztack API routing harness.
 *
 * Mixed ownership. The Template source owns the routing harness and the
 * registration function. Derived projects extend routing by adding
 * `registerRoute(...)` calls inside the Sync seam marked below. Do not edit
 * the harness itself from a Derived project.
 */

import type { IncomingMessage, ServerResponse } from "node:http";

export type RouteHandler = (
  req: IncomingMessage,
  res: ServerResponse
) => void | Promise<void>;

const routes = new Map<string, RouteHandler>();

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

export function dispatch(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const handler = routes.get(req.url ?? "/");
  if (!handler) {
    res.statusCode = 404;
    res.end("Not Found");
    return Promise.resolve();
  }
  return Promise.resolve(handler(req, res));
}

export const __templateVersion = "1.1.0";
