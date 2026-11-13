import { IconHelp, IconSettings } from "@tabler/icons-react";
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
    <a data-router="true" href={to}>
      {children}
    </a>
  ),
}));

import { NavSecondary } from "./nav-secondary";

describe("NavSecondary", () => {
  it("routes in-app items through the router", () => {
    const html = renderToStaticMarkup(
      <NavSecondary items={[{ title: "Settings", url: "/settings", icon: IconSettings }]} />,
    );

    expect(html).toContain('data-router="true"');
    expect(html).toContain('href="/settings"');
  });

  it("opens external items in a new tab without the opener", () => {
    const html = renderToStaticMarkup(
      <NavSecondary
        items={[{ title: "Help", url: "https://docs.example.com", icon: IconHelp, external: true }]}
      />,
    );

    expect(html).not.toContain("data-router");
    expect(html).toContain('href="https://docs.example.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });
});
