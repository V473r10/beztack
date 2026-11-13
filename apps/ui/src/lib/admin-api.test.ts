import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ADMIN_API_PREFIX, adminApi, adminUrl } from "./admin-api";

const here = dirname(fileURLToPath(import.meta.url));
const uiSrc = join(here, "..");
const apiRoutesRoot = join(here, "../../../api/server/routes/api");
const apiAdminRoutes = join(apiRoutesRoot, "auth/admin");

type NitroRoute = { method: string | null; segments: string[] };

/**
 * Nitro file-based routes under `directory`: `plans/[id].patch.ts` is `PATCH /plans/:id`.
 * Paths are relative to `root` (default: the admin prefix directory).
 */
function collectNitroRoutes(directory: string, root = apiAdminRoutes): NitroRoute[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      return collectNitroRoutes(entryPath, root);
    }
    const parts = relative(root, entryPath)
      .replace(/\.[cm]?[jt]s$/, "")
      .split("/");
    const last = parts.pop() ?? "";
    const [name, suffix] = last.split(".");
    const method = suffix ? suffix.toUpperCase() : null;
    const segments = [...parts, ...(name === "index" ? [] : [name])].map((segment) =>
      segment.replace(/^\[(.+)\]$/, ":$1"),
    );
    return [{ method, segments }];
  });
}

function routeExists(routes: NitroRoute[], method: string, path: string): boolean {
  const wanted = path.split("/").filter(Boolean);
  return routes.some(
    (route) =>
      (route.method === null || route.method === method) &&
      route.segments.length === wanted.length &&
      route.segments.every((segment, i) => segment.startsWith(":") || segment === wanted[i]),
  );
}

const UI_CALL_URL = /(["'`])(\/api\/[^"'`]*)\1/g;

/** Index just after the parenthesis that closes the call whose arguments start at `start`. */
function endOfCall(text: string, start: number): number {
  let depth = 1;
  let index = start;
  for (; index < text.length && depth > 0; index++) {
    if (text[index] === "(") {
      depth++;
    } else if (text[index] === ")") {
      depth--;
    }
  }
  return index;
}

/**
 * Calls the UI makes to a route the API does not have. The contract test found this one when it
 * was extended past the admin routes; it predates the live demo work. The Mercado Pago return
 * page (`subscription-welcome`) fetches a raw Mercado Pago preapproval from it, and no route
 * serves that (only `GET /api/subscriptions/:id`, a different shape, and the webhook exist). It
 * needs its own route or a move to the existing one. The list must shrink: the test below fails
 * when an entry starts to exist, so remove it then.
 */
const KNOWN_MISSING_ROUTES = ["GET /api/payments/mercado-pago/subscriptions/:param"];

type UiCall = { file: string; method: string; path: string };

/**
 * The API URLs the UI calls with a literal (`requestJson("/api/subscriptions/checkout", {...})`):
 * `${id}` after a slash is a path parameter, `${query}` glued to a segment is a query string.
 * The method is the call's `method: "X"` option, GET when there is none.
 */
function collectUiApiCalls(): UiCall[] {
  const calls: UiCall[] = [];
  for (const file of collectSourceFiles(uiSrc)) {
    if (/admin-api\.ts$|\.test\.tsx?$/.test(file)) {
      continue;
    }
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(UI_CALL_URL)) {
      const [, quote, literal] = match;
      if (quote !== "`" && literal.includes("${")) {
        continue;
      }
      const path = literal
        .replace(/\/\$\{[^}]*\}/g, "/:param")
        .replace(/\$\{[^}]*\}/g, "")
        .split("?")[0];
      const tail = text.slice(match.index, endOfCall(text, match.index));
      const method = /method:\s*["'`]([A-Z]+)["'`]/.exec(tail)?.[1] ?? "GET";
      calls.push({ file: relative(uiSrc, file), method, path });
    }
  }
  return calls;
}

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      return collectSourceFiles(entryPath);
    }
    return /\.(ts|tsx)$/.test(entry.name) ? [entryPath] : [];
  });
}

describe("admin API contract", () => {
  it("prefixes every admin path with /api/auth/admin", () => {
    expect(ADMIN_API_PREFIX).toBe("/api/auth/admin");
    expect(adminUrl(adminApi.planSyncStatus)).toBe("/api/auth/admin/plans/sync-status");
  });

  it("fills and encodes path parameters", () => {
    expect(adminUrl(adminApi.planUpdate, { id: "a/b" })).toBe("/api/auth/admin/plans/a%2Fb");
  });

  it("only lists endpoints that exist as API routes with that method", () => {
    const routes = collectNitroRoutes(apiAdminRoutes);
    const missing = Object.entries(adminApi)
      .filter(([, endpoint]) => !routeExists(routes, endpoint.method, endpoint.path))
      .map(([name, endpoint]) => `${name}: ${endpoint.method} ${endpoint.path}`);

    expect(missing).toEqual([]);
  });

  it("only calls API endpoints that exist as routes with that method (not just the admin ones)", () => {
    const routes = collectNitroRoutes(apiRoutesRoot, apiRoutesRoot);
    const calls = collectUiApiCalls();

    // The scanner finds the calls the app really makes.
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: "POST", path: "/api/subscriptions/checkout" }),
        expect.objectContaining({ method: "GET", path: "/api/subscriptions/products" }),
      ]),
    );

    const missing = [
      ...new Set(
        calls
          .filter((call) => !call.path.startsWith("/api/auth/admin"))
          .filter((call) => !routeExists(routes, call.method, call.path.replace(/^\/api/, "")))
          .map((call) => `${call.method} ${call.path}`),
      ),
    ];

    expect(missing).toEqual(KNOWN_MISSING_ROUTES);
  });

  it("keeps admin URLs out of the rest of the UI source", () => {
    const offenders = collectSourceFiles(uiSrc)
      .filter((file) => !/admin-api\.ts$|\.test\.tsx?$/.test(file))
      .filter((file) => /\/api\/(auth\/)?admin\b/.test(readFileSync(file, "utf8")))
      .map((file) => relative(uiSrc, file));

    expect(offenders).toEqual([]);
  });
});
