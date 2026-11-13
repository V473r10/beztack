import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/env", () => ({ env: { VITE_APP_NAME: "Acme" } }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
}));
vi.mock("@/hooks/use-theme", () => ({
  useTheme: () => ({ theme: "system", setTheme: vi.fn() }),
}));

import { PricingBar } from "./pricing-bar";

function renderBar(isSignedIn: boolean) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <PricingBar isSignedIn={isSignedIn} />
    </MemoryRouter>,
  );
}

describe("Pricing bar", () => {
  it("takes a signed-in visitor back to the app", () => {
    const html = renderBar(true);

    expect(html).toContain('href="/"');
    expect(html).toContain("pricing.bar.backToApp");
    expect(html).not.toContain("pricing.bar.signIn");
  });

  it("offers sign-in to a visitor without an account", () => {
    const html = renderBar(false);

    expect(html).toContain('href="/auth/sign-in"');
    expect(html).toContain("pricing.bar.signIn");
    expect(html).not.toContain("pricing.bar.backToApp");
  });

  it("carries the language and theme controls", () => {
    const html = renderBar(false);

    expect(html).toContain("sidebar.userMenu.language");
    expect(html).toContain("common.theme.toggle");
  });

  it("names the app", () => {
    expect(renderBar(false)).toContain("Acme");
  });
});
