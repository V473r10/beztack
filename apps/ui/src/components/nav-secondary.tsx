"use client";

import type { Icon } from "@tabler/icons-react";
import type * as React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

/** Things a sidebar item can do instead of going to a page. */
export type NavAction = "open-command-palette";

export function NavSecondary({
  items,
  onAction,
  ...props
}: {
  items: {
    title: string;
    url: string;
    icon: Icon;
    id?: string;
    external?: boolean;
    action?: NavAction;
  }[];
  onAction?: (action: NavAction) => void;
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const { t } = useTranslation();
  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.action ?? item.url}>
              {item.action ? (
                <SidebarMenuButton
                  id={item.id}
                  onClick={() => item.action && onAction?.(item.action)}
                >
                  <item.icon />
                  <span>{t(item.title)}</span>
                </SidebarMenuButton>
              ) : (
                <SidebarMenuButton asChild id={item.id}>
                  {item.external ? (
                    <a href={item.url} rel="noopener noreferrer" target="_blank">
                      <item.icon />
                      <span>{t(item.title)}</span>
                    </a>
                  ) : (
                    <Link to={item.url}>
                      <item.icon />
                      <span>{t(item.title)}</span>
                    </Link>
                  )}
                </SidebarMenuButton>
              )}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
