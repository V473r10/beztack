import type { Page, Route } from "@playwright/test";
import {
  adminUser,
  failedPlanChanges,
  membershipStatus,
  metrics,
  organization,
  products,
  session,
  subscriptions,
  syncStatus,
  users,
} from "./fixtures";

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
type Handler = (url: URL) => unknown;

const JSON_HEADERS = { "content-type": "application/json" };

/** `METHOD /path` -> response body. Paths are matched exactly, query strings ignored. */
function buildRoutes(signedIn: boolean): Record<string, Handler> {
  return {
    // better-auth client
    "GET /api/auth/get-session": () => (signedIn ? { session, user: adminUser } : null),
    "GET /api/auth/organization/list": () => (signedIn ? [organization] : []),
    "GET /api/auth/organization/get-full-organization": () => (signedIn ? organization : null),
    "GET /api/auth/organization/list-members": () => ({
      members: organization.members,
      total: organization.members.length,
    }),
    "GET /api/auth/organization/list-invitations": () => [],
    "GET /api/auth/admin/list-users": () => ({
      users,
      total: users.length,
      limit: users.length,
      offset: 0,
    }),

    // subscriptions and membership
    "GET /api/membership/status": () => membershipStatus,
    "GET /api/subscriptions/products": () => products,
    "GET /api/subscriptions": () => subscriptions,
    "GET /api/subscriptions/plan-change/pending": () => ({ pendingPlanChange: null }),
    "GET /api/invitations/me": () => [],

    // App admin
    "GET /api/auth/admin/metrics": () => metrics,
    "GET /api/auth/admin/plans/sync-status": () => syncStatus,
    "GET /api/auth/admin/plan-changes/failed": () => failedPlanChanges,
  };
}

/** A request the mock has no fixture for. The audit fails on these so fixtures cannot silently rot. */
export type UnmockedRequest = `${Method} ${string}`;

/**
 * Answer every `/api/*` request of `page` from fixtures. No request reaches a network.
 * Returns the list of requests that had no fixture (they get a 404).
 */
export async function mockApi(
  page: Page,
  { signedIn }: { signedIn: boolean },
): Promise<UnmockedRequest[]> {
  const routes = buildRoutes(signedIn);
  const unmocked: UnmockedRequest[] = [];

  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route: Route) => {
      const request = route.request();
      const url = new URL(request.url());
      const key = `${request.method()} ${url.pathname}`;
      const handler = routes[key];

      if (!handler) {
        unmocked.push(key as UnmockedRequest);
        await route.fulfill({
          status: 404,
          headers: JSON_HEADERS,
          body: JSON.stringify({ message: `No E2E fixture for ${key}` }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        headers: JSON_HEADERS,
        body: JSON.stringify(handler(url)),
      });
    },
  );

  return unmocked;
}
