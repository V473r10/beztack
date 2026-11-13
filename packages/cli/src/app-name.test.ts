import { describe, expect, it } from "vitest";
import { applyAppName } from "./app-name.js";

describe("applyAppName", () => {
  it("rewrites APP_NAME and VITE_APP_NAME to the project name", () => {
    const content = ["APP_NAME=beztack", "VITE_APP_NAME=beztack", "OTHER=beztack", ""].join("\n");

    expect(applyAppName(content, "my-shop")).toBe(
      ["APP_NAME=my-shop", "VITE_APP_NAME=my-shop", "OTHER=beztack", ""].join("\n"),
    );
  });

  it("leaves an env file without the entries unchanged", () => {
    const content = "VITE_API_URL=http://localhost:3000\n";

    expect(applyAppName(content, "my-shop")).toBe(content);
  });
});
