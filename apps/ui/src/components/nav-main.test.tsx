import { IconDashboard } from "@tabler/icons-react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/sidebar", () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    SidebarGroup: Pass,
    SidebarGroupContent: Pass,
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

import { NavMain } from "./nav-main";

describe("NavMain", () => {
  const html = renderToStaticMarkup(
    <NavMain items={[{ title: "Dashboard", url: "/", icon: IconDashboard }]} />,
  );

  it("lists its items", () => {
    expect(html).toContain('href="/"');
    expect(html).toContain("Dashboard");
  });

  it("has no template leftovers that do nothing", () => {
    expect(html).not.toContain("Quick Create");
    expect(html).not.toContain("Inbox");
    expect(html).not.toContain("<button");
  });
});
