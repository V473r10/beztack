import { renderInLanguage } from "@/test/render-in-language";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  env: {} as { VITE_DOCS_URL?: string },
  membership: null as null | {
    isAppAdmin: boolean;
    organizationRole: string | null;
    canManageBilling: boolean;
  },
}));

vi.mock("@/env", () => ({
  get env() {
    return mocks.env;
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

import { AppSidebar, findNavItem, getSidebarSections } from "./app-sidebar";

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
  beforeEach(() => {
    as({});
    mocks.env = {};
  });

  it("member: no Organization or Platform section", () => {
    as({ organizationRole: "member" });
    const html = renderInLanguage("en", <AppSidebar />);

    expect(section(html, "Organization")).toEqual([]);
    expect(section(html, "Platform")).toEqual([]);
    expect(section(html, "main")).toContain("/");
  });

  it("Organization admin who is not Billing manager: Organizations only", () => {
    as({ organizationRole: "admin" });
    const html = renderInLanguage("en", <AppSidebar />);

    expect(section(html, "Organization")).toEqual(["/organizations"]);
    expect(section(html, "Platform")).toEqual([]);
  });

  it("owner and Billing manager: Organizations and Billing", () => {
    as({ organizationRole: "owner", canManageBilling: true });
    const html = renderInLanguage("en", <AppSidebar />);

    expect(section(html, "Organization")).toEqual(["/organizations", "/billing"]);
  });

  it("App admin outside any Organization: Platform and Billing, no Organizations", () => {
    as({ isAppAdmin: true, canManageBilling: true });
    const html = renderInLanguage("en", <AppSidebar />);

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
    expect(section(renderInLanguage("en", <AppSidebar />), "Platform")).toEqual([]);
  });
});

describe("AppSidebar secondary links", () => {
  const nobody = { isAppAdmin: false, organizationRole: null, canManageBilling: false };

  it("never links to a dead '#' target", () => {
    const urls = Object.values(getSidebarSections(nobody, "https://docs.example.com"))
      .flat()
      .map((item) => item.url);

    expect(urls).not.toContain("#");
  });

  it("every item either goes somewhere or does something", () => {
    const items = Object.values(getSidebarSections(nobody, "https://docs.example.com")).flat();

    expect(items.filter((item) => !(item.url || item.action))).toEqual([]);
  });

  it("hides Get Help when no docs URL is configured", () => {
    const urls = getSidebarSections(nobody).secondary.map((item) => item.url);

    expect(urls).toEqual(["", "/pricing", "/settings"]);
  });

  it("links Get Help to the configured docs URL, outside the app", () => {
    const help = getSidebarSections(nobody, "https://docs.example.com/help").secondary.find(
      (item) => item.url === "https://docs.example.com/help",
    );

    expect(help).toMatchObject({ title: "sidebar.nav.getHelp", external: true });
  });

  it("renders the configured docs URL in the sidebar", () => {
    mocks.env = { VITE_DOCS_URL: "https://docs.example.com/help" };

    expect(section(renderInLanguage("en", <AppSidebar />), "secondary")).toContain(
      "https://docs.example.com/help",
    );
  });

  it("opens the command palette from Search, for every role", () => {
    const search = getSidebarSections(nobody).secondary.find(
      (item) => item.title === "sidebar.nav.search",
    );

    expect(search).toMatchObject({ action: "open-command-palette" });
  });
});

describe("findNavItem", () => {
  it("finds the sidebar entry for a page", () => {
    expect(findNavItem("/billing")?.url).toBe("/billing");
    expect(findNavItem("/admin/plan-changes")?.url).toBe("/admin/plan-changes");
    expect(findNavItem("/")?.url).toBe("/");
  });

  it("matches nested pages to their section, most specific first", () => {
    expect(findNavItem("/admin/users/123")?.url).toBe("/admin/users");
    expect(findNavItem("/admin")?.url).toBe("/admin");
  });

  it("does not match the dashboard for unknown pages", () => {
    expect(findNavItem("/checkout-confirm")).toBeUndefined();
  });
});
