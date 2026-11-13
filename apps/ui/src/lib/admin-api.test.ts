import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ADMIN_API_PREFIX, adminApi, adminUrl } from "./admin-api";

const here = dirname(fileURLToPath(import.meta.url));
const uiSrc = join(here, "..");
const apiAdminRoutes = join(here, "../../../api/server/routes/api/auth/admin");

type NitroRoute = { method: string | null; segments: string[] };

/** Nitro file-based routes under the admin prefix: `plans/[id].patch.ts` is `PATCH /plans/:id`. */
function collectNitroRoutes(directory: string): NitroRoute[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      return collectNitroRoutes(entryPath);
    }
    const parts = relative(apiAdminRoutes, entryPath)
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

  it("keeps admin URLs out of the rest of the UI source", () => {
    const offenders = collectSourceFiles(uiSrc)
      .filter((file) => !/admin-api\.ts$|\.test\.tsx?$/.test(file))
      .filter((file) => /\/api\/(auth\/)?admin\b/.test(readFileSync(file, "utf8")))
      .map((file) => relative(uiSrc, file));

    expect(offenders).toEqual([]);
  });
});
