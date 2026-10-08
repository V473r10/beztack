import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  membership: null as null | {
    isAppAdmin: boolean;
    organizationRole: string | null;
    canManageBilling: boolean;
  },
}));

vi.mock("@/contexts/membership-context", () => ({
  useOptionalMembership: () => mocks.membership,
}));
vi.mock("@/components/organizations", () => ({ OrganizationSwitcher: () => null }));
vi.mock("@/components/nav-user", () => ({ NavUser: () => null }));
vi.mock("@/components/nav-main", () => ({
  NavMain: ({ items }: { items: { url: string }[] }) => (
    <nav data-section="main">
      {items.map((item) => (
        <a href={item.url} key={item.url}>
          {item.url}
        </a>
      ))}
    </nav>
  ),
}));
vi.mock("@/components/nav-secondary", () => ({
  NavSecondary: ({ items, title }: { items: { url: string }[]; title?: string }) => (
    <nav data-section={title ?? "secondary"}>
      {items.map((item) => (
        <a href={item.url} key={`${item.url}-${item.url.length}`}>
          {item.url}
        </a>
      ))}
    </nav>
  ),
}));
vi.mock("@/components/ui/sidebar", () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    Sidebar: Pass,
    SidebarContent: Pass,
    SidebarFooter: Pass,
    SidebarHeader: Pass,
    SidebarMenu: Pass,
    SidebarMenuButton: Pass,
    SidebarMenuItem: Pass,
  };
});
vi.mock("react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

import { AppSidebar, getSidebarSections } from "./app-sidebar";

function as(access: Partial<NonNullable<typeof mocks.membership>>) {
  mocks.membership = {
    isAppAdmin: false,
    organizationRole: null,
    canManageBilling: false,
    ...access,
  };
}

function section(html: string, name: string): string[] {
  const match = html.match(new RegExp(`<nav data-section="${name}">(.*?)</nav>`));
  return match ? [...match[1].matchAll(/href="([^"]+)"/g)].map((m) => m[1]) : [];
}

describe("AppSidebar by role", () => {
  beforeEach(() => as({}));

  it("member: no Organization or Platform section", () => {
    as({ organizationRole: "member" });
    const html = renderToStaticMarkup(<AppSidebar />);

    expect(section(html, "Organization")).toEqual([]);
    expect(section(html, "Platform")).toEqual([]);
    expect(section(html, "main")).toContain("/");
  });

  it("Organization admin who is not Billing manager: Organizations only", () => {
    as({ organizationRole: "admin" });
    const html = renderToStaticMarkup(<AppSidebar />);

    expect(section(html, "Organization")).toEqual(["/organizations"]);
    expect(section(html, "Platform")).toEqual([]);
  });

  it("owner and Billing manager: Organizations and Billing", () => {
    as({ organizationRole: "owner", canManageBilling: true });
    const html = renderToStaticMarkup(<AppSidebar />);

    expect(section(html, "Organization")).toEqual(["/organizations", "/billing"]);
  });

  it("App admin outside any Organization: Platform and Billing, no Organizations", () => {
    as({ isAppAdmin: true, canManageBilling: true });
    const html = renderToStaticMarkup(<AppSidebar />);

    expect(section(html, "Organization")).toEqual(["/billing"]);
    expect(section(html, "Platform")).toEqual([
      "/admin",
      "/admin/users",
      "/admin/analytics",
      "/admin/plans",
      "/admin/plan-changes",
    ]);
  });

  it("outside a MembershipProvider nothing role-gated shows", () => {
    mocks.membership = null;
    const sections = getSidebarSections({
      isAppAdmin: false,
      organizationRole: null,
      canManageBilling: false,
    });

    expect(sections.organization).toEqual([]);
    expect(section(renderToStaticMarkup(<AppSidebar />), "Platform")).toEqual([]);
  });
});
