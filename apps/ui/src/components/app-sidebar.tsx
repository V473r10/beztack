import {
  IconAlertTriangle,
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
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { NavMain } from "@/components/nav-main";
import { type NavAction, NavSecondary } from "@/components/nav-secondary";
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
import { useOptionalCommandPalette } from "@/contexts/command-palette-context";
import { useOptionalMembership } from "@/contexts/membership-context";
import { env } from "@/env";
import { TOUR_STEP_IDS } from "@/lib/tour-constants";

/** What a sidebar item may require of the caller; see {@link RouteAccess}. */
type NavRequirement = "organization-admin" | "billing-manager" | "app-admin";

export type SidebarNavItem = {
  title: string;
  url: string;
  icon: Icon;
  id?: string;
  requires?: NavRequirement;
  /** Opens outside the app (new tab) instead of through the router. */
  external?: boolean;
  /** Does something instead of going to a page; `url` is empty. */
  action?: NavAction;
};

export type SidebarAccess = RouteAccess;

const NAV_MAIN: SidebarNavItem[] = [
  { title: "sidebar.nav.dashboard", url: "/", icon: IconDashboard },
  { title: "sidebar.nav.ai", url: "/ai", icon: IconBrain },
  { title: "sidebar.nav.ocr", url: "/ocr", icon: IconScan },
];

/** "Organization" section: management and billing of the Active organization. */
const NAV_ORGANIZATION: SidebarNavItem[] = [
  {
    title: "sidebar.nav.organizations",
    url: "/organizations",
    icon: IconBuilding,
    requires: "organization-admin",
  },
  {
    title: "sidebar.nav.billing",
    url: "/billing",
    icon: IconCreditCard,
    requires: "billing-manager",
  },
];

/** "Platform" section: App admin tools. */
const NAV_PLATFORM: SidebarNavItem[] = [
  { title: "sidebar.nav.platformAdmin", url: "/admin", icon: IconShield, requires: "app-admin" },
  {
    title: "sidebar.nav.userManagement",
    url: "/admin/users",
    icon: IconUserCog,
    requires: "app-admin",
  },
  {
    title: "sidebar.nav.analytics",
    url: "/admin/analytics",
    icon: IconChartBar,
    requires: "app-admin",
  },
  {
    title: "sidebar.nav.planSync",
    url: "/admin/plans",
    icon: IconListDetails,
    requires: "app-admin",
  },
  {
    title: "sidebar.nav.failedPlanChanges",
    url: "/admin/plan-changes",
    icon: IconAlertTriangle,
    requires: "app-admin",
  },
];

const NAV_SECONDARY: SidebarNavItem[] = [
  { title: "sidebar.nav.pricing", url: "/pricing", icon: IconCrown },
  {
    title: "sidebar.nav.settings",
    url: "/settings",
    icon: IconSettings,
    id: TOUR_STEP_IDS.SETTINGS_BUTTON,
  },
  // "Search" and "Get Help" are added by getSidebarSections ("Get Help" only when
  // VITE_DOCS_URL is set); a link that goes nowhere does not ship.
];

/** Opens the command palette, which lists the pages of the other sections. */
const SEARCH_ITEM: SidebarNavItem = {
  title: "sidebar.nav.search",
  url: "",
  icon: IconSearch,
  action: "open-command-palette",
};

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
export function getSidebarSections(access: SidebarAccess, docsUrl?: string) {
  const visible = (items: SidebarNavItem[]) => items.filter((item) => meets(item.requires, access));
  const help: SidebarNavItem[] = docsUrl
    ? [{ title: "sidebar.nav.getHelp", url: docsUrl, icon: IconHelp, external: true }]
    : [];
  return {
    main: visible(NAV_MAIN),
    organization: visible(NAV_ORGANIZATION),
    platform: visible(NAV_PLATFORM),
    secondary: [SEARCH_ITEM, ...visible(NAV_SECONDARY), ...help],
  };
}

/**
 * The sidebar entry for a page, so the header can name the page the same way the menu does.
 * The most specific URL wins (`/admin/users/1` is User Management, not Platform Admin).
 */
export function findNavItem(pathname: string): SidebarNavItem | undefined {
  const matches = [...NAV_MAIN, ...NAV_ORGANIZATION, ...NAV_PLATFORM, ...NAV_SECONDARY].filter(
    (item) => item.url === pathname || (item.url !== "/" && pathname.startsWith(`${item.url}/`)),
  );
  return matches.sort((a, b) => b.url.length - a.url.length)[0];
}

export const NO_ACCESS: SidebarAccess = {
  isAppAdmin: false,
  organizationRole: null,
  canManageBilling: false,
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { t } = useTranslation();
  const membership = useOptionalMembership();
  const palette = useOptionalCommandPalette();
  const sections = getSidebarSections(membership ?? NO_ACCESS, env.VITE_DOCS_URL);
  // Without a palette to open, Search would be a button that does nothing.
  const secondary = palette
    ? sections.secondary
    : sections.secondary.filter((item) => !item.action);

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader className="space-y-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:!p-1.5">
              <Link to="/">
                <IconInnerShadowTop className="!size-5" />
                <span className="font-semibold text-base">{env.VITE_APP_NAME}</span>
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
          <NavSecondary items={sections.organization} title={t("sidebar.groups.organization")} />
        )}
        {sections.platform.length > 0 && (
          <NavSecondary items={sections.platform} title={t("sidebar.groups.platform")} />
        )}
        <NavSecondary
          className="mt-auto"
          items={secondary}
          onAction={(action) => {
            if (action === "open-command-palette") {
              palette?.open();
            }
          }}
        />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
