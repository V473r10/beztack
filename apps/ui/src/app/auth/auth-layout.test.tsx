import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ Toaster: () => <div data-testid="toaster" /> }));
vi.mock("react-router", () => ({ Outlet: () => <div data-testid="outlet" /> }));
vi.mock("@/components/language-selector", () => ({ LanguageSelector: () => null }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import AuthLayout from "./auth-layout";

describe("AuthLayout", () => {
  it("mounts the Toaster so auth toasts are visible on the auth routes", () => {
    const html = renderToStaticMarkup(<AuthLayout />);

    expect(html).toContain('data-testid="toaster"');
    expect(html).toContain('data-testid="outlet"');
  });
});
