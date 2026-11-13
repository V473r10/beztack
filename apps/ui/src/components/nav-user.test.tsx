import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: null as null | { name: string; email: string; image?: string | null },
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: mocks.user ? { user: mocks.user } : null }),
    signOut: vi.fn(),
  },
}));
vi.mock("@/contexts/membership-context", () => ({
  useMembership: () => ({ currentTier: "free" }),
}));
vi.mock("@/components/payments/membership-badge", () => ({ MembershipBadge: () => null }));
vi.mock("@/components/tour", () => ({ useTour: () => ({ startTour: vi.fn() }) }));
vi.mock("react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  AvatarImage: () => null,
  AvatarFallback: ({ children }: { children?: React.ReactNode }) => (
    <i data-fallback="true">{children}</i>
  ),
}));
vi.mock("@/components/ui/dropdown-menu", () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    DropdownMenu: Pass,
    DropdownMenuContent: Pass,
    DropdownMenuGroup: Pass,
    DropdownMenuItem: Pass,
    DropdownMenuLabel: Pass,
    DropdownMenuPortal: Pass,
    DropdownMenuRadioGroup: Pass,
    DropdownMenuRadioItem: Pass,
    DropdownMenuSeparator: Pass,
    DropdownMenuSub: Pass,
    DropdownMenuSubContent: Pass,
    DropdownMenuSubTrigger: Pass,
    DropdownMenuTrigger: Pass,
  };
});
vi.mock("@/components/ui/sidebar", () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    SidebarMenu: Pass,
    SidebarMenuButton: Pass,
    SidebarMenuItem: Pass,
    useSidebar: () => ({ isMobile: false }),
  };
});

import { NavUser } from "./nav-user";

function fallbacks(html: string): string[] {
  return [...html.matchAll(/<i data-fallback="true">(.*?)<\/i>/g)].map((m) => m[1]);
}

describe("NavUser", () => {
  beforeEach(() => {
    mocks.user = { name: "Ada Lovelace", email: "ada@example.com" };
  });

  it("shows the user's initials in the avatar", () => {
    const html = renderToStaticMarkup(<NavUser />);

    expect(fallbacks(html)).toEqual(["AL", "AL"]);
    expect(html).not.toContain(">CN<");
  });

  it("falls back to the email while the user has no name", () => {
    mocks.user = { name: "", email: "zed@example.com" };

    expect(fallbacks(renderToStaticMarkup(<NavUser />))).toEqual(["Z", "Z"]);
  });

  it("has no menu entries that do nothing", () => {
    const html = renderToStaticMarkup(<NavUser />);

    expect(html).not.toContain("sidebar.userMenu.notifications");
    expect(html).toContain("sidebar.userMenu.billing");
    expect(html).toContain("sidebar.userMenu.signOut");
  });
});
