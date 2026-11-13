import { defineConfig } from "@playwright/test";

/**
 * Mobile layout audit (BZ-117). The API is mocked in the browser (`e2e/mock-api.ts`),
 * so the run needs no database, no payment provider and no API server: only the UI,
 * built with the env below and served by `vite preview`.
 *
 * Locally, point `E2E_CHROMIUM_PATH` at a system Chromium (for example
 * `/usr/bin/chromium`) to skip the browser download. In CI the browser comes from
 * `playwright install --with-deps chromium`.
 */
const PORT = Number(process.env.E2E_PORT ?? 5184);
const HOST = "127.0.0.1";
const BASE_URL = `http://${HOST}:${PORT}`;
const CHROMIUM_PATH = process.env.E2E_CHROMIUM_PATH || undefined;
const SERVER_START_TIMEOUT_MS = 180_000;
const TEST_TIMEOUT_MS = 60_000;

/** Phone widths from BZ-105 V6: a small Android and an iPhone Pro. */
const VIEWPORTS = [
  { name: "mobile-360", width: 360, height: 740 },
  { name: "mobile-393", width: 393, height: 852 },
] as const;

/** The UI build the audit runs against. Nothing here is a secret. */
const UI_ENV = {
  VITE_API_URL: BASE_URL,
  VITE_APP_NAME: "Beztack",
  VITE_PAYMENT_PROVIDER: "polar",
  VITE_SUBSCRIPTION_MODE: "organization",
  VITE_DEMO_MODE: "true",
  VITE_DEFAULT_CURRENCY: "USD",
  VITE_DEFAULT_LOCALE: "en-US",
};

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  outputDir: "./test-results",
  timeout: TEST_TIMEOUT_MS,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: process.env.CI ? 2 : 1,
  reporter: process.env.CI
    ? [["github"], ["list"], ["html", { open: "never", outputFolder: "playwright-report" }]]
    : [["list"]],
  use: {
    baseURL: BASE_URL,
    // Viewport screenshots only: a full-page capture of a broken layout can be thousands of px tall.
    screenshot: { mode: "only-on-failure", fullPage: false },
    reducedMotion: "reduce",
    isMobile: true,
    hasTouch: true,
    launchOptions: CHROMIUM_PATH ? { executablePath: CHROMIUM_PATH } : {},
  },
  projects: VIEWPORTS.map(({ name, width, height }) => ({
    name,
    use: { browserName: "chromium", viewport: { width, height } },
  })),
  webServer: {
    // `vite dev` re-optimizes dependencies on first visit and reloads the page mid-test; a build does not.
    command: `pnpm exec vite build --outDir dist-e2e && pnpm exec vite preview --outDir dist-e2e --host ${HOST} --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: SERVER_START_TIMEOUT_MS,
    env: UI_ENV,
    stdout: "ignore",
    stderr: "ignore",
  },
});
