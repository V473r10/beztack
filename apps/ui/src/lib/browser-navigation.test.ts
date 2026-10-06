import { afterEach, describe, expect, it, vi } from "vitest";
import { redirectToExternalUrl } from "./browser-navigation";

describe("redirectToExternalUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the browser to the given URL", () => {
    const location = { href: "https://app.example.test/pricing" };
    vi.stubGlobal("window", { location });

    redirectToExternalUrl("https://checkout.example.test/session/1");

    expect(location.href).toBe("https://checkout.example.test/session/1");
  });
});
