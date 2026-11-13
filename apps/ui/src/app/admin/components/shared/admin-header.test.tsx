import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./admin-breadcrumb", () => ({ AdminBreadcrumb: () => <nav>breadcrumb</nav> }));
vi.mock("@/components/ui/sidebar", () => ({
  SidebarTrigger: () => <button data-testid="sidebar-trigger" type="button" />,
}));

import { AdminHeader } from "./admin-header";

const html = renderToStaticMarkup(
  <AdminHeader action={<button type="button">Act</button>} description="About" title="Users" />,
);

describe("AdminHeader", () => {
  it("leaves the sidebar toggle to the app shell header", () => {
    expect(html).not.toContain("sidebar-trigger");
  });

  it("grows and wraps instead of overlapping on a narrow screen", () => {
    const header = html.match(/<header class="([^"]*)"/)?.[1] ?? "";

    expect(header).toContain("min-h-16");
    expect(header).not.toMatch(/(^|\s)h-16(\s|$)/);
    expect(header).toContain("flex-wrap");
    expect(html).toContain("min-w-0");
  });

  it("hides the description below md", () => {
    const description = html.match(/<p class="([^"]*)">About<\/p>/)?.[1] ?? "";

    expect(description).toContain("hidden");
    expect(description).toContain("md:block");
  });

  it("keeps title, description and action", () => {
    expect(html).toContain("Users");
    expect(html).toContain("About");
    expect(html).toContain("Act");
  });
});
