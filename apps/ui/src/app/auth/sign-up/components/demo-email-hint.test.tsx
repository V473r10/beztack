import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ env: { VITE_DEMO_MODE: true } }));

vi.mock("@/env", () => ({ env: mocks.env }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import { DemoEmailHint } from "./demo-email-hint";

describe("DemoEmailHint", () => {
  beforeEach(() => {
    mocks.env.VITE_DEMO_MODE = true;
  });

  it("suggests an email with a real domain in the live demo", () => {
    const html = renderToStaticMarkup(<DemoEmailHint />);

    expect(html).toContain("auth.signUp.demoEmailHint");
  });

  it("renders nothing outside demo mode", () => {
    mocks.env.VITE_DEMO_MODE = false;

    expect(renderToStaticMarkup(<DemoEmailHint />)).toBe("");
  });
});
