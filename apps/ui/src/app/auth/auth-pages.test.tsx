import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ env: { VITE_APP_NAME: "Acme Billing", VITE_DEMO_MODE: false } }));

vi.mock("@/env", () => ({ env: mocks.env }));
vi.mock("react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options?.appName ? `${key} | ${String(options.appName)}` : key,
  }),
}));
vi.mock("./sign-in/components/form", () => ({ SignInForm: () => <form data-testid="sign-in" /> }));
vi.mock("./sign-up/components/form", () => ({ SignUpForm: () => <form data-testid="sign-up" /> }));
vi.mock("./sign-up/components/demo-email-hint", () => ({ DemoEmailHint: () => null }));

import SignIn from "./sign-in/sign-in";
import SignUp from "./sign-up/sign-up";

const countMatches = (html: string, pattern: RegExp) => html.match(pattern)?.length ?? 0;

describe.each([
  ["sign-in", SignIn, "auth.signIn.title", "auth.signIn.pageTitle"],
  ["sign-up", SignUp, "auth.signUp.title", "auth.signUp.pageTitle"],
])("%s page", (_name, Page, titleKey, pageTitleKey) => {
  it("has a single h1 holding the page title, with no duplicated title", () => {
    const html = renderToStaticMarkup(<Page />);

    expect(countMatches(html, /<h1[ >]/g)).toBe(1);
    expect(countMatches(html, new RegExp(titleKey.replaceAll(".", "\\."), "g"))).toBe(1);
  });

  it("sets a document title naming the page and the app", () => {
    const html = renderToStaticMarkup(<Page />);

    expect(html).toContain(`<title>${pageTitleKey} | Acme Billing</title>`);
  });
});
