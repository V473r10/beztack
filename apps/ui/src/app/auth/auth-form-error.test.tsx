import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AuthFormError } from "./auth-form-error";

describe("AuthFormError", () => {
  it("shows the message inside a live region", () => {
    const html = renderToStaticMarkup(<AuthFormError message="Incorrect email or password." />);

    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Incorrect email or password.");
  });

  it("keeps an empty live region mounted so a later error is announced", () => {
    const html = renderToStaticMarkup(<AuthFormError message={null} />);

    expect(html).toContain('aria-live="polite"');
    expect(html).not.toContain("<p");
  });
});
