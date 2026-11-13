import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { auditLayout, describeViolations } from "./layout-audit";
import { mockApi } from "./mock-api";

/** Where the UI remembers an explicit language choice (`LANGUAGE_STORAGE_KEY` in `create-i18n.ts`). */
const LANGUAGE_STORAGE_KEY = "i18nextLng";
const SETTLE_TIMEOUT_MS = 15_000;

/** First-run state of a returning visitor: the onboarding tours would otherwise cover the page. */
const RETURNING_VISITOR_STORAGE = {
  home_tour_completed: "true",
  settings_tour_completed: "true",
};

const LANGUAGES = ["en", "es"] as const;

type AuditedRoute = {
  name: string;
  path: string;
  /** Auth pages are for visitors; every other page is audited as a signed-in App admin. */
  signedIn: boolean;
};

const ROUTES: AuditedRoute[] = [
  { name: "sign-in", path: "/auth/sign-in", signedIn: false },
  { name: "sign-up", path: "/auth/sign-up", signedIn: false },
  { name: "home", path: "/", signedIn: true },
  { name: "pricing", path: "/pricing", signedIn: true },
  { name: "billing", path: "/billing", signedIn: true },
  { name: "organizations", path: "/organizations", signedIn: true },
  { name: "admin", path: "/admin", signedIn: true },
  { name: "admin/users", path: "/admin/users", signedIn: true },
  { name: "admin/plans", path: "/admin/plans", signedIn: true },
  { name: "admin/plan-changes", path: "/admin/plan-changes", signedIn: true },
];

/** Top-level groups of `en.json`: a visible `group.something` is a key that never got translated. */
const keyNamespaces = Object.keys(
  JSON.parse(readFileSync(new URL("../src/lib/i18n/locales/en.json", import.meta.url), "utf8")),
);

for (const language of LANGUAGES) {
  test.describe(`mobile layout (${language})`, () => {
    for (const route of ROUTES) {
      test(`${route.name} has no layout problems`, async ({ page }) => {
        await page.addInitScript(
          (entries: Record<string, string>) => {
            for (const [key, value] of Object.entries(entries)) {
              window.localStorage.setItem(key, value);
            }
          },
          { ...RETURNING_VISITOR_STORAGE, [LANGUAGE_STORAGE_KEY]: language },
        );
        const unmocked = await mockApi(page, { signedIn: route.signedIn });

        await page.goto(route.path);
        await page.waitForLoadState("networkidle");
        // Wait out the route guards and loading spinners before looking at the page.
        await expect(page.locator(".animate-spin, [aria-label='Loading']")).toHaveCount(0, {
          timeout: SETTLE_TIMEOUT_MS,
        });

        // A redirect means the page under audit is not the one asked for (for example a guard bounced us).
        expect(new URL(page.url()).pathname, "route was redirected").toBe(route.path);
        await expect(page.locator("html")).toHaveAttribute("lang", language);
        // An open dialog covers the page, so the audit would pass without looking at it.
        await expect(
          page.locator("[role=dialog], [role=alertdialog]"),
          "a dialog covers the page",
        ).toHaveCount(0);

        const violations = await auditLayout(page, keyNamespaces);
        expect(
          violations,
          `layout problems on ${route.path}:\n${describeViolations(violations)}`,
        ).toEqual([]);
        expect(unmocked, "API requests with no fixture in e2e/mock-api.ts").toEqual([]);
      });
    }
  });
}
