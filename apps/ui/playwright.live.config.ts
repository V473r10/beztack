import { defineConfig } from "@playwright/test";

/**
 * Live smoke test (BZ-134, spec BZ-131). Loads two deployed sites in a real browser and checks
 * that they render. It is separate from the mobile layout audit (`playwright.config.ts`): no
 * mock API, no web server, no build, and not part of CI. Run it with `pnpm test:live`.
 *
 * The base URLs come from `LIVE_WEB_URL` and `LIVE_APP_URL` (see `e2e/README.md`).
 * Locally, point `E2E_CHROMIUM_PATH` at a system Chromium to skip the browser download.
 */
const CHROMIUM_PATH = process.env.E2E_CHROMIUM_PATH || undefined;
const TEST_TIMEOUT_MS = 30_000;
const WORKERS = 2;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.live.ts",
  outputDir: "./test-results/live",
  timeout: TEST_TIMEOUT_MS,
  fullyParallel: true,
  retries: 0,
  workers: WORKERS,
  reporter: [["list"]],
  use: {
    // Viewport screenshots only: a full-page capture of a broken page can be thousands of px tall.
    screenshot: { mode: "only-on-failure", fullPage: false },
    viewport: { width: 1280, height: 800 },
    launchOptions: CHROMIUM_PATH ? { executablePath: CHROMIUM_PATH } : {},
  },
  projects: [{ name: "live", use: { browserName: "chromium" } }],
});
