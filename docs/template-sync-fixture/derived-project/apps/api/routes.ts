/**
 * Beztack API routing harness — Derived project copy.
 *
 * Mixed ownership via the api-route-registration Sync seam. The Template
 * source owns the harness above and below the seam; the Derived project
 * owns the registerRoute(...) calls inside the seam.
 *
 * On a Template update from v1.1.0 to v1.2.0 the harness is rewritten but
 * the seam block below MUST be preserved verbatim by the Sync engine.
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

/* ── Derived project seam contents — DO NOT EDIT FROM TEMPLATE SOURCE ── */
registerRoute("/health", (_req, res) => {
  res.statusCode = 200;
  res.end("ok");
});

registerRoute("/api/products/:id", (req, res) => {
  res.statusCode = 200;
  res.end(JSON.stringify({ id: req.url?.split("/").pop() ?? "" }));
});
/* ── end seam ── */
