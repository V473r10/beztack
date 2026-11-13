import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("@/env", () => ({ env: {} }));
vi.mock("react-router", () => ({ useLocation: () => ({ pathname: mocks.pathname }) }));
vi.mock("@/components/ui/sidebar", () => ({
  SidebarTrigger: () => <button data-testid="sidebar-trigger" type="button" />,
  Sidebar: () => null,
  SidebarContent: () => null,
  SidebarFooter: () => null,
  SidebarHeader: () => null,
  SidebarMenu: () => null,
  SidebarMenuButton: () => null,
  SidebarMenuItem: () => null,
}));
// The page title comes from the sidebar's own item list; its widgets are not under test.
vi.mock("@/contexts/membership-context", () => ({ useOptionalMembership: () => null }));
vi.mock("@/components/organizations", () => ({ OrganizationSwitcher: () => null }));
vi.mock("@/components/nav-user", () => ({ NavUser: () => null }));
vi.mock("@/components/nav-main", () => ({ NavMain: () => null }));
vi.mock("@/components/nav-secondary", () => ({ NavSecondary: () => null }));

import { SiteHeader } from "./site-header";

function heading(html: string): string {
  return html.match(/<h1[^>]*>(.*?)<\/h1>/)?.[1] ?? "";
}

describe("SiteHeader", () => {
  beforeEach(() => {
    mocks.pathname = "/";
  });

  it("names the current page the way the menu does", () => {
    mocks.pathname = "/billing";
    expect(heading(renderToStaticMarkup(<SiteHeader />))).toBe("sidebar.nav.billing");

    mocks.pathname = "/admin/plan-changes";
    expect(heading(renderToStaticMarkup(<SiteHeader />))).toBe("sidebar.nav.failedPlanChanges");
  });

  it("never says 'Documents'", () => {
    for (const pathname of ["/", "/settings", "/billing", "/checkout-confirm", "/nowhere"]) {
      mocks.pathname = pathname;
      expect(renderToStaticMarkup(<SiteHeader />)).not.toContain("Documents");
    }
  });

  it("names pages that are not in the menu", () => {
    mocks.pathname = "/checkout-confirm";

    expect(heading(renderToStaticMarkup(<SiteHeader />))).toBe("header.pageTitles.checkoutConfirm");
  });

  it("has no link to the shadcn template repo", () => {
    expect(renderToStaticMarkup(<SiteHeader />)).not.toContain("shadcn");
  });

  it("has one sidebar trigger", () => {
    const html = renderToStaticMarkup(<SiteHeader />);

    expect(html.match(/data-testid="sidebar-trigger"/g)).toHaveLength(1);
  });
});
