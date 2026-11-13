import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  useNavigate: () => vi.fn(),
  useLocation: () => ({ search: "" }),
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({}) }));
vi.mock("../../auth-submissions", () => ({ submitSignIn: vi.fn() }));

import { SignInForm } from "./form";

describe("SignInForm", () => {
  it("shows no field error before the user types or submits", () => {
    const html = renderToStaticMarkup(<SignInForm />);

    expect(html).not.toContain('data-slot="form-message"');
    expect(html).not.toContain('aria-invalid="true"');
  });

  it("puts the control id and the error wiring on the inputs themselves", () => {
    const html = renderToStaticMarkup(<SignInForm />);

    const inputs = html.match(/<input[^>]*>/g) ?? [];
    expect(inputs).toHaveLength(2);
    for (const input of inputs) {
      expect(input).toContain('data-slot="form-control"');
      expect(input).toContain("aria-describedby=");
    }
  });
});
