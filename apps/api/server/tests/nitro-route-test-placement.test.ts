import { readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const routeTestFilePattern = /\.(test|spec)\.[cm]?[jt]sx?$/;

function collectRouteTestFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectRouteTestFiles(entryPath);
    }

    if (entry.isFile() && routeTestFilePattern.test(entry.name)) {
      return [entryPath];
    }

    return [];
  });
}

describe("Nitro route test placement", () => {
  it("keeps test files outside server/routes", () => {
    const routesDirectory = join(
      dirname(fileURLToPath(import.meta.url)),
      "../routes"
    );
    const routeTestFiles = collectRouteTestFiles(routesDirectory).map((file) =>
      relative(routesDirectory, file)
    );

    expect(routeTestFiles).toEqual([]);
  });
});
