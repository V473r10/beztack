import { describe, expect, it } from "vitest";
import { resolveAllowedOrigins } from "./cors-origins";

describe("resolveAllowedOrigins", () => {
  it("reads every origin from the comma-separated CORS_ORIGINS", () => {
    const origins = resolveAllowedOrigins({
      corsOrigins: " https://app.example.com , https://admin.example.com/ ,",
      appUrl: "https://app.example.com/dashboard",
    });

    expect(origins).toEqual(["https://app.example.com", "https://admin.example.com"]);
  });

  it("always allows the origin of APP_URL", () => {
    const origins = resolveAllowedOrigins({
      corsOrigins: "",
      appUrl: "http://localhost:5173/",
    });

    expect(origins).toEqual(["http://localhost:5173"]);
  });

  it("allows nothing hardcoded beyond the configuration", () => {
    const origins = resolveAllowedOrigins({
      corsOrigins: "https://new-domain.example",
      appUrl: "https://new-domain.example",
    });

    expect(origins).toEqual(["https://new-domain.example"]);
  });
});
