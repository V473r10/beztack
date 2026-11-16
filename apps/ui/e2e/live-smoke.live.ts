import { expect, test } from "@playwright/test";

/**
 * Live smoke test (BZ-134, spec BZ-131): read-only page loads against deployed sites.
 * It never signs in and never submits a form. Run it with `pnpm test:live`.
 *
 * A 200 proves little here: the UI is a single-page app that answers 200 on every path, so each
 * check waits for content that only renders when the site actually works.
 */
const RENDER_TIMEOUT_MS = 15_000;

/** Reads a base URL from the environment and fails with a message that names the variable. */
function baseUrlFrom(variable: "LIVE_WEB_URL" | "LIVE_APP_URL"): string {
  const value = process.env[variable]?.trim();
  if (!value) {
    throw new Error(
      `${variable} is not set. Set it to the site's base URL, for example ${variable}=https://www.beztack.com`,
    );
  }
  try {
    return new URL(value).toString();
  } catch {
    throw new Error(`${variable} is not a valid URL: "${value}"`);
  }
}

test("marketing home renders its content", async ({ page }) => {
  const webUrl = baseUrlFrom("LIVE_WEB_URL");

  const response = await page.goto(webUrl);
  expect(response?.status(), `GET ${webUrl} did not answer 2xx`).toBeLessThan(400);

  await expect(
    page.getByRole("heading", { level: 1 }),
    `${webUrl} did not render the marketing home headline (an <h1> mentioning "B2B SaaS")`,
  ).toContainText("B2B SaaS", { timeout: RENDER_TIMEOUT_MS });
});
