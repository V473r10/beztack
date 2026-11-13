import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import {
  getSidebarSections,
  NO_ACCESS,
  type SidebarAccess,
  type SidebarNavItem,
} from "@/components/app-sidebar";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { CommandPaletteContext } from "@/contexts/command-palette-context";
import { useOptionalMembership } from "@/contexts/membership-context";

type KeyEventLike = Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey">;

/** Cmd+K on macOS, Ctrl+K elsewhere; extra modifiers belong to the browser. */
export function isCommandPaletteShortcut(event: KeyEventLike): boolean {
  return (
    event.key.toLowerCase() === "k" &&
    (event.metaKey || event.ctrlKey) &&
    !event.shiftKey &&
    !event.altKey
  );
}

const GROUPS = ["main", "organization", "platform", "secondary"] as const;

/** Pages the palette can jump to: what the sidebar shows, minus actions and outside links. */
function pagesOf(items: SidebarNavItem[]): SidebarNavItem[] {
  return items.filter((item) => !(item.action || item.external));
}

/** The pages `access` may open, grouped like the sidebar. Same source, same rules. */
export function CommandPaletteList({
  access,
  onSelect,
}: {
  access: SidebarAccess;
  onSelect: (url: string) => void;
}) {
  const { t } = useTranslation();
  const sections = getSidebarSections(access);

  return (
    <CommandList>
      <CommandEmpty>{t("commandPalette.empty")}</CommandEmpty>
      {GROUPS.map((group) => {
        const pages = pagesOf(sections[group]);
        if (pages.length === 0) {
          return null;
        }
        return (
          <CommandGroup heading={t(`commandPalette.groups.${group}`)} key={group}>
            {pages.map((page) => (
              <CommandItem
                key={page.url}
                keywords={[page.url]}
                onSelect={() => onSelect(page.url)}
                value={t(page.title)}
              >
                <page.icon />
                <span>{t(page.title)}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        );
      })}
    </CommandList>
  );
}

/** Owns the open state and the Cmd/Ctrl+K shortcut; render {@link CommandPalette} inside. */
export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isCommandPaletteShortcut(event)) {
        event.preventDefault();
        setIsOpen((current) => !current);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const controls = useMemo(() => ({ open: () => setIsOpen(true) }), []);

  return (
    <CommandPaletteContext.Provider value={controls}>
      {children}
      <CommandPaletteDialog onOpenChange={setIsOpen} open={isOpen} />
    </CommandPaletteContext.Provider>
  );
}

function CommandPaletteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const membership = useOptionalMembership();

  return (
    <CommandDialog
      description={t("commandPalette.description")}
      onOpenChange={onOpenChange}
      open={open}
      title={t("commandPalette.title")}
    >
      <CommandInput placeholder={t("commandPalette.placeholder")} />
      <CommandPaletteList
        access={membership ?? NO_ACCESS}
        onSelect={(url) => {
          onOpenChange(false);
          navigate(url);
        }}
      />
    </CommandDialog>
  );
}
