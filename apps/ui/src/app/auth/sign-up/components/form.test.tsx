import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("react-router", () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ search: "" }),
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({}) }));
vi.mock("../../auth-submissions", () => ({ submitSignUp: vi.fn() }));

import { SignUpForm } from "./form";

describe("SignUpForm", () => {
  it("describes the password input with the rules checklist", () => {
    const html = renderToStaticMarkup(<SignUpForm />);

    const input = html.match(/<input[^>]*autoComplete="new-password"[^>]*>/i)?.[0] ?? "";
    const describedBy = input.match(/aria-describedby="([^"]+)"/)?.[1] ?? "";
    expect(describedBy).not.toBe("");
    expect(html).toContain(`id="${describedBy.split(" ")[0]}"`);
    expect(html).toMatch(new RegExp(`id="${describedBy.split(" ")[0]}"[^>]*><p`));
  });

  it("lists the five rules as pending, with no error shown before the user types", () => {
    const html = renderToStaticMarkup(<SignUpForm />);

    expect(html.match(/data-state="pending"/g)).toHaveLength(5);
    expect(html).not.toContain('data-slot="form-message"');
    expect(html).not.toContain('aria-invalid="true"');
  });
});
