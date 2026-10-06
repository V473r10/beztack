import {
  IconBrain,
  IconBuilding,
  IconChartBar,
  IconCreditCard,
  IconCrown,
  IconDashboard,
  IconHelp,
  IconInnerShadowTop,
  IconListDetails,
  IconScan,
  IconSearch,
  IconSettings,
  IconShield,
  IconUserCog,
  type Icon,
} from "@tabler/icons-react";
import { hasAuthRole } from "@beztack/auth";
import type * as React from "react";
import { Link } from "react-router";
import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import type { RouteAccess } from "@/components/protected-route";
import { OrganizationSwitcher } from "@/components/organizations";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useOptionalMembership } from "@/contexts/membership-context";
import { TOUR_STEP_IDS } from "@/lib/tour-constants";

/** What a sidebar item may require of the caller; see {@link RouteAccess}. */
type NavRequirement = "organization-admin" | "billing-manager" | "app-admin";

export type SidebarNavItem = {
  title: string;
  url: string;
  icon: Icon;
  id?: string;
  requires?: NavRequirement;
};

export type SidebarAccess = RouteAccess;

const NAV_MAIN: SidebarNavItem[] = [
  { title: "sidebar.dashboard", url: "/", icon: IconDashboard },
  { title: "AI", url: "/ai", icon: IconBrain },
  { title: "OCR", url: "/ocr", icon: IconScan },
];

/** "Organization" section: management and billing of the Active organization. */
const NAV_ORGANIZATION: SidebarNavItem[] = [
  {
    title: "Organizations",
    url: "/organizations",
    icon: IconBuilding,
    requires: "organization-admin",
  },
  { title: "Billing", url: "/billing", icon: IconCreditCard, requires: "billing-manager" },
];

/** "Platform" section: App admin tools. */
const NAV_PLATFORM: SidebarNavItem[] = [
  { title: "Platform Admin", url: "/admin", icon: IconShield, requires: "app-admin" },
  { title: "User Management", url: "/admin/users", icon: IconUserCog, requires: "app-admin" },
  { title: "Analytics", url: "/admin/analytics", icon: IconChartBar, requires: "app-admin" },
  { title: "Plan Sync", url: "/admin/plans", icon: IconListDetails, requires: "app-admin" },
];

const NAV_SECONDARY: SidebarNavItem[] = [
  { title: "Pricing", url: "/pricing", icon: IconCrown },
  {
    title: "sidebar.secondary.settings",
    url: "/settings",
    icon: IconSettings,
    id: TOUR_STEP_IDS.SETTINGS_BUTTON,
  },
  { title: "sidebar.secondary.getHelp", url: "#", icon: IconHelp },
  { title: "sidebar.secondary.search", url: "#", icon: IconSearch },
];

function meets(requirement: NavRequirement | undefined, access: SidebarAccess): boolean {
  switch (requirement) {
    case undefined:
      return true;
    case "organization-admin":
      return ["admin", "owner"].some((role) => hasAuthRole<string>(access.organizationRole, role));
    case "billing-manager":
      return access.canManageBilling;
    case "app-admin":
      return access.isAppAdmin;
    default:
      return false;
  }
}

/** The sidebar sections and the items each caller may use. Same rules as the routes. */
export function getSidebarSections(access: SidebarAccess) {
  const visible = (items: SidebarNavItem[]) => items.filter((item) => meets(item.requires, access));
  return {
    main: visible(NAV_MAIN),
    organization: visible(NAV_ORGANIZATION),
    platform: visible(NAV_PLATFORM),
    secondary: visible(NAV_SECONDARY),
  };
}

const NO_ACCESS: SidebarAccess = {
  isAppAdmin: false,
  organizationRole: null,
  canManageBilling: false,
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const membership = useOptionalMembership();
  const sections = getSidebarSections(membership ?? NO_ACCESS);

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader className="space-y-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:!p-1.5">
              <Link to="/">
                <IconInnerShadowTop className="!size-5" />
                <span className="font-semibold text-base">beztack</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="px-2">
          <OrganizationSwitcher
            className="w-full"
            onManageOrganizations={() => {
              // This will be handled by the OrganizationSwitcher's routing
            }}
          />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={sections.main} />
        {sections.organization.length > 0 && (
          <NavSecondary items={sections.organization} title="Organization" />
        )}
        {sections.platform.length > 0 && (
          <NavSecondary items={sections.platform} title="Platform" />
        )}
        <NavSecondary className="mt-auto" items={sections.secondary} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
