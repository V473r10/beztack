import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import { PasswordChecklist } from "./password-checklist";

const states = (html: string) =>
  [...html.matchAll(/data-rule="(\w+)" data-state="(\w+)"/g)].map((m) => `${m[1]}:${m[2]}`);

describe("PasswordChecklist", () => {
  it("shows every rule as pending, not as an error, before the user types", () => {
    const html = renderToStaticMarkup(<PasswordChecklist id="rules" password="" />);

    expect(states(html)).toEqual([
      "length:pending",
      "uppercase:pending",
      "lowercase:pending",
      "number:pending",
      "special:pending",
    ]);
    expect(html).not.toContain("text-destructive");
  });

  it("ticks a rule as soon as the typed password meets it", () => {
    const html = renderToStaticMarkup(<PasswordChecklist id="rules" password="abc" />);

    expect(states(html)).toContain("lowercase:met");
    expect(states(html)).toContain("length:pending");
  });

  it("marks unmet rules as failed only once errors are revealed", () => {
    const html = renderToStaticMarkup(<PasswordChecklist id="rules" password="abc" showUnmet />);

    expect(states(html)).toEqual([
      "length:unmet",
      "uppercase:unmet",
      "lowercase:met",
      "number:unmet",
      "special:unmet",
    ]);
  });

  it("marks everything as met for a valid password", () => {
    const html = renderToStaticMarkup(
      <PasswordChecklist id="rules" password="Abcdef1!" showUnmet />,
    );

    expect(states(html).every((entry) => entry.endsWith(":met"))).toBe(true);
  });

  it("carries the id the password input points at, and a text status for screen readers", () => {
    const html = renderToStaticMarkup(<PasswordChecklist id="rules" password="abc" />);

    expect(html).toContain('id="rules"');
    expect(html).toContain("form.password.ruleMet");
    expect(html).toContain("form.password.rulePending");
  });
});
