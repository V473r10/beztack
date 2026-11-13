import { expect, test } from "@playwright/test";
import { mockApi } from "./mock-api";

/** Where the UI remembers an explicit language choice (`LANGUAGE_STORAGE_KEY` in `create-i18n.ts`). */
const LANGUAGE_STORAGE_KEY = "i18nextLng";
const TOO_MANY_REQUESTS = 429;

test.describe("billing when the payment provider rate-limits (BZ-128)", () => {
  test("shows an error with a retry, never a skeleton, and recovers on retry", async ({ page }) => {
    await page.addInitScript((key: string) => {
      window.localStorage.setItem(key, "en");
      window.localStorage.setItem("home_tour_completed", "true");
      window.localStorage.setItem("settings_tour_completed", "true");
    }, LANGUAGE_STORAGE_KEY);
    await mockApi(page, { signedIn: true });

    // The first Subscription list of the active organization is rate-limited; later ones fall
    // through to the fixture. (The page first asks without an organization, while it loads.)
    let subscriptionRequests = 0;
    await page.route(
      (url) => url.pathname === "/api/subscriptions" && url.searchParams.has("organizationId"),
      async (route) => {
        subscriptionRequests += 1;
        if (subscriptionRequests > 1) {
          await route.fallback();
          return;
        }
        await route.fulfill({
          status: TOO_MANY_REQUESTS,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            statusCode: TOO_MANY_REQUESTS,
            statusMessage: "The payment provider is busy. Try again in a moment.",
            data: { code: "provider_rate_limited" },
          }),
        });
      },
    );

    await page.goto("/billing");

    await expect(page.getByText("Too many requests were sent to the payment provider")).toBeVisible(
      { timeout: 15_000 },
    );
    await expect(page.locator(".animate-pulse")).toHaveCount(0);
    // A 429 is not retried on its own: that would only add requests.
    expect(subscriptionRequests).toBe(1);

    await page.getByRole("button", { name: "Try again" }).click();

    await expect(page.getByRole("heading", { name: "Billing & Subscription" })).toBeVisible({
      timeout: 15_000,
    });
    expect(subscriptionRequests).toBe(2);
  });
});
