import { renderInLanguage } from "@/test/render-in-language";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ env: { VITE_DEMO_MODE: true } }));

vi.mock("@/env", () => ({ env: mocks.env }));

import { DemoBanner } from "./demo-banner";

describe("DemoBanner", () => {
  beforeEach(() => {
    mocks.env.VITE_DEMO_MODE = true;
  });

  it("tells visitors payments are sandbox and data resets daily", () => {
    const html = renderInLanguage("en", <DemoBanner />);

    expect(html).toContain("Demo:");
    expect(html).toContain("sandbox payments, data resets");
    expect(html).toContain("daily");
  });

  it("says it in Spanish when the visitor chose Spanish", () => {
    const html = renderInLanguage("es", <DemoBanner />);

    expect(html).toContain("Demo:");
    expect(html).toContain("pagos de prueba, los datos se borran todos los días");
    expect(html).not.toContain("sandbox payments");
  });

  it("renders nothing outside demo mode", () => {
    mocks.env.VITE_DEMO_MODE = false;

    expect(renderInLanguage("en", <DemoBanner />)).toBe("");
  });
});
