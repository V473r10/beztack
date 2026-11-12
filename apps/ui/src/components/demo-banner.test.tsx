import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ env: { VITE_DEMO_MODE: true } }));

vi.mock("@/env", () => ({ env: mocks.env }));

import { DemoBanner } from "./demo-banner";

describe("DemoBanner", () => {
  beforeEach(() => {
    mocks.env.VITE_DEMO_MODE = true;
  });

  it("tells visitors payments are sandbox and data resets daily", () => {
    const html = renderToStaticMarkup(<DemoBanner />);

    expect(html).toContain("Demo:");
    expect(html).toContain("sandbox payments, data resets");
    expect(html).toContain("daily");
  });

  it("renders nothing outside demo mode", () => {
    mocks.env.VITE_DEMO_MODE = false;

    expect(renderToStaticMarkup(<DemoBanner />)).toBe("");
  });
});
