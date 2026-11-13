import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  env: {
    VITE_DEMO_MODE: true,
    VITE_PAYMENT_PROVIDER: "polar",
    VITE_DEMO_ADMIN_EMAIL: "admin@example.com",
    VITE_DEMO_ADMIN_PASSWORD: "s3cret-admin-password",
  } as Record<string, unknown>,
}));

vi.mock("@/env", () => ({ env: mocks.env }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${Object.values(options).join(" ")}` : key,
  }),
}));

import { DemoTryPanel } from "./demo-try-panel";

describe("DemoTryPanel", () => {
  beforeEach(() => {
    mocks.env.VITE_DEMO_MODE = true;
    mocks.env.VITE_PAYMENT_PROVIDER = "polar";
  });

  it("renders nothing outside demo mode", () => {
    mocks.env.VITE_DEMO_MODE = false;

    expect(renderToStaticMarkup(<DemoTryPanel variant="brand" />)).toBe("");
    expect(renderToStaticMarkup(<DemoTryPanel variant="compact" />)).toBe("");
  });

  it("shows the Polar sandbox test cards and the daily wipe notice in demo mode", () => {
    const html = renderToStaticMarkup(<DemoTryPanel variant="brand" />);

    expect(html).toContain("auth.demo.title");
    expect(html).toContain("4242 4242 4242 4242");
    expect(html).not.toContain("5031 7557 3453 0604");
    expect(html).toContain("auth.demo.dataReset");
  });

  it("shows the Mercado Pago sandbox test cards when that provider is active", () => {
    mocks.env.VITE_PAYMENT_PROVIDER = "mercadopago";

    const html = renderToStaticMarkup(<DemoTryPanel variant="brand" />);

    expect(html).toContain("5031 7557 3453 0604");
    expect(html).toContain("4509 9535 6623 3704");
    expect(html).toContain("APRO");
    expect(html).not.toContain("4242 4242 4242 4242");
  });

  it("never shows the admin credentials", () => {
    const html = renderToStaticMarkup(<DemoTryPanel variant="brand" />);

    expect(html).not.toContain("s3cret-admin-password");
    expect(html).not.toContain("admin@example.com");
  });

  it("collapses into a details element on mobile so it does not cover the form", () => {
    const compact = renderToStaticMarkup(<DemoTryPanel variant="compact" />);
    const brand = renderToStaticMarkup(<DemoTryPanel variant="brand" />);

    expect(compact).toContain("<details");
    expect(compact).not.toMatch(/<details[^>]* open/);
    expect(brand).not.toContain("<details");
  });
});
