import {
  IconBuilding,
  IconCamera,
  IconChartBar,
  IconCreditCard,
  IconCrown,
  IconDashboard,
  IconDatabase,
  IconFileAi,
  IconFileDescription,
  IconFileWord,
  IconFolder,
  IconHelp,
  IconInnerShadowTop,
  IconListDetails,
  IconReport,
  IconSearch,
  IconSettings,
  IconShield,
  IconUserCog,
  IconUsers,
} from "@tabler/icons-react";
import type * as React from "react";
import { Link } from "react-router";
import { NavDocuments } from "@/components/nav-documents";
import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
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
import { useIsAdmin } from "@/lib/admin-utils";
import { TOUR_STEP_IDS } from "@/lib/tour-constants";

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    {
      title: "sidebar.dashboard",
      url: "#",
      icon: IconDashboard,
    },
    {
      title: "sidebar.lifecycle",
      url: "#",
      icon: IconListDetails,
    },
    {
      title: "sidebar.analytics",
      url: "#",
      icon: IconChartBar,
    },
    {
      title: "sidebar.projects",
      url: "#",
      icon: IconFolder,
    },
    {
      title: "sidebar.team",
      url: "#",
      icon: IconUsers,
    },
  ],
  navClouds: [
    {
      title: "sidebar.capture",
      icon: IconCamera,
      isActive: true,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
    {
      title: "sidebar.proposal",
      icon: IconFileDescription,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
    {
      title: "sidebar.prompts",
      icon: IconFileAi,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: "Organizations",
      url: "organizations",
      icon: IconBuilding,
    },
    {
      title: "Billing",
      url: "billing",
      icon: IconCreditCard,
    },
    {
      title: "Pricing",
      url: "pricing",
      icon: IconCrown,
    },
    {
      title: "sidebar.secondary.settings",
      url: "settings",
      icon: IconSettings,
      id: TOUR_STEP_IDS.SETTINGS_BUTTON,
    },
    {
      title: "sidebar.secondary.getHelp",
      url: "#",
      icon: IconHelp,
    },
    {
      title: "sidebar.secondary.search",
      url: "#",
      icon: IconSearch,
    },
  ],
  navAdmin: [
    {
      title: "Admin Panel",
      url: "/admin",
      icon: IconShield,
    },
    {
      title: "User Management",
      url: "/admin/users",
      icon: IconUserCog,
    },
    {
      title: "Admin Analytics",
      url: "/admin/analytics",
      icon: IconChartBar,
    },
  ],
  documents: [
    {
      name: "sidebar.documents.dataLibrary",
      url: "#",
      icon: IconDatabase,
    },
    {
      name: "sidebar.documents.reports",
      url: "#",
      icon: IconReport,
    },
    {
      name: "sidebar.documents.wordAssistant",
      url: "#",
      icon: IconFileWord,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const isAdmin = useIsAdmin();

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader className="space-y-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
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
        <NavMain items={data.navMain} />
        <NavDocuments items={data.documents} />
        {isAdmin && (
          <NavSecondary items={data.navAdmin} title="Administration" />
        )}
        <NavSecondary className="mt-auto" items={data.navSecondary} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  );
}
