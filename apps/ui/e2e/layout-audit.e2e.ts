import { expect, test } from "@playwright/test";
import { auditLayout } from "./layout-audit";

/**
 * The audit must be able to fail: each case feeds it a page with exactly one known
 * problem and checks that the matching rule fires (and that a clean page stays clean).
 */
const NAMESPACES = ["billing", "admin"];

async function rulesFor(page: import("@playwright/test").Page, body: string): Promise<string[]> {
  await page.setContent(
    `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0">${body}</body></html>`,
  );
  return (await auditLayout(page, NAMESPACES)).map((violation) => violation.rule);
}

test.describe("layout audit self-check", () => {
  test("a clean page has no violations", async ({ page }) => {
    const rules = await rulesFor(
      page,
      `<button>Save</button><a href="/x">Home</a><p>billing is a plain word, and so is admin.</p>`,
    );
    expect(rules).toEqual([]);
  });

  test("flags a page that scrolls sideways", async ({ page }) => {
    const rules = await rulesFor(page, `<div style="width:900px;height:10px">wide</div>`);
    expect(rules).toContain("horizontal-scroll");
  });

  test("flags a button past the viewport edge", async ({ page }) => {
    const rules = await rulesFor(
      page,
      `<div style="overflow:hidden"><button style="margin-left:600px">Far away</button></div>`,
    );
    expect(rules).toContain("past-viewport");
  });

  test("allows a button inside a container that scrolls sideways", async ({ page }) => {
    const rules = await rulesFor(
      page,
      `<div style="overflow-x:auto;width:200px"><div style="width:900px"><button style="margin-left:600px">Reachable</button></div></div>`,
    );
    expect(rules).toEqual([]);
  });

  test("flags a button whose label wraps", async ({ page }) => {
    const rules = await rulesFor(
      page,
      `<button style="width:80px;white-space:normal">Create new organization now</button>`,
    );
    expect(rules).toContain("wrapped-button");
  });

  test("allows a long accordion question to wrap", async ({ page }) => {
    const rules = await rulesFor(
      page,
      `<button data-slot="accordion-trigger" style="width:80px">How does billing work for teams?</button>`,
    );
    expect(rules).toEqual([]);
  });

  test("flags a raw i18n key in text and in an attribute", async ({ page }) => {
    const rules = await rulesFor(
      page,
      `<p>billing.page.title</p><input placeholder="admin.users.search" />`,
    );
    expect(rules.filter((rule) => rule === "raw-i18n-key")).toHaveLength(2);
  });

  test("does not mistake emails or domains for keys", async ({ page }) => {
    const rules = await rulesFor(
      page,
      `<p>ada@billing.example.com and https://admin.example.com</p>`,
    );
    expect(rules).toEqual([]);
  });
});
