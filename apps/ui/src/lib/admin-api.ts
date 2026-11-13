/**
 * Every App admin route `apps/ui` calls on the Beztack API.
 *
 * The API serves them under `/api/auth/admin` (see `apps/api/server/routes/api/auth/admin`).
 * Build URLs with `adminUrl` so the prefix lives in one place; `admin-api.test.ts`
 * fails when an endpoint listed here has no matching API route.
 */
export const ADMIN_API_PREFIX = "/api/auth/admin";

type AdminEndpoint = {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  /** Path under `ADMIN_API_PREFIX`; `:name` segments are filled by `adminUrl`. */
  path: string;
};

export const adminApi = {
  metrics: { method: "GET", path: "/metrics" },
  planSyncStatus: { method: "GET", path: "/plans/sync-status" },
  planSync: { method: "POST", path: "/plans/sync" },
  planImport: { method: "POST", path: "/plans/import" },
  planCreate: { method: "POST", path: "/plans" },
  planUpdate: { method: "PATCH", path: "/plans/:id" },
  planDelete: { method: "DELETE", path: "/plans/:id" },
  failedPlanChanges: { method: "GET", path: "/plan-changes/failed" },
  retryPlanChange: { method: "POST", path: "/plan-changes/:id/retry" },
} as const satisfies Record<string, AdminEndpoint>;

export function adminUrl(endpoint: AdminEndpoint, params: Record<string, string> = {}): string {
  const path = endpoint.path.replace(/:(\w+)/g, (_, name: string) =>
    encodeURIComponent(params[name] ?? ""),
  );
  return `${ADMIN_API_PREFIX}${path}`;
}
