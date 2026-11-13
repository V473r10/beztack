import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";
import { findNavItem } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

/** Pages inside the app shell that the sidebar does not list. */
const UNLISTED_PAGE_TITLES: Record<string, string> = {
  "/checkout-confirm": "header.pageTitles.checkoutConfirm",
};

const APP_NAME = "beztack";

export function SiteHeader() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const titleKey = findNavItem(pathname)?.title ?? UNLISTED_PAGE_TITLES[pathname];

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full min-w-0 items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator className="mx-2 data-[orientation=vertical]:h-4" orientation="vertical" />
        <h1 className="truncate font-medium text-base">{titleKey ? t(titleKey) : APP_NAME}</h1>
      </div>
    </header>
  );
}
