import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ env: { VITE_APP_NAME: "Acme Billing", VITE_DEMO_MODE: false } }));

vi.mock("@/env", () => ({ env: mocks.env }));
vi.mock("sonner", () => ({ Toaster: () => <div data-testid="toaster" /> }));
vi.mock("react-router", () => ({ Outlet: () => <div data-testid="outlet" /> }));
vi.mock("@/components/language-toggle", () => ({ LanguageToggle: () => null }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options?.appName ? `${key} for ${String(options.appName)}` : key,
  }),
}));
vi.mock("./demo-try-panel", () => ({
  DemoTryPanel: ({ variant }: { variant: string }) => <div data-testid={`demo-panel-${variant}`} />,
}));

import AuthLayout from "./auth-layout";

describe("AuthLayout", () => {
  it("mounts the Toaster so auth toasts are visible on the auth routes", () => {
    const html = renderToStaticMarkup(<AuthLayout />);

    expect(html).toContain('data-testid="toaster"');
    expect(html).toContain('data-testid="outlet"');
  });

  it("brands the panel and the footer with VITE_APP_NAME", () => {
    const html = renderToStaticMarkup(<AuthLayout />);

    expect(html).toContain("Acme Billing");
    expect(html).toContain("common.footer for Acme Billing");
    expect(html).not.toContain("Your Company");
  });

  it("renders no heading, so each page keeps a single h1", () => {
    const html = renderToStaticMarkup(<AuthLayout />);

    expect(html).not.toMatch(/<h[1-6]/);
  });

  it("renders the demo panel in the brand column and, collapsed, under the form on mobile", () => {
    const html = renderToStaticMarkup(<AuthLayout />);

    expect(html).toContain('data-testid="demo-panel-brand"');
    expect(html).toContain('data-testid="demo-panel-compact"');
  });
});
