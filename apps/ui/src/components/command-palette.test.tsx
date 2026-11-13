import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/env", () => ({ env: {} }));

import { Command } from "@/components/ui/command";
import { CommandPaletteList, isCommandPaletteShortcut } from "./command-palette";

const nobody = { isAppAdmin: false, organizationRole: null, canManageBilling: false };

function render(access: typeof nobody) {
  return renderToStaticMarkup(
    <Command>
      <CommandPaletteList access={access} onSelect={() => undefined} />
    </Command>,
  );
}

describe("CommandPaletteList by role", () => {
  it("a regular user sees no admin pages", () => {
    const html = render({ ...nobody, organizationRole: "member" });

    expect(html).toContain("sidebar.nav.dashboard");
    expect(html).toContain("sidebar.nav.settings");
    expect(html).not.toContain("sidebar.nav.platformAdmin");
    expect(html).not.toContain("sidebar.nav.userManagement");
    expect(html).not.toContain("sidebar.nav.analytics");
    expect(html).not.toContain("sidebar.nav.planSync");
    expect(html).not.toContain("sidebar.nav.failedPlanChanges");
    expect(html).not.toContain("sidebar.nav.organizations");
    expect(html).not.toContain("sidebar.nav.billing");
  });

  it("an App admin sees the platform pages", () => {
    const html = render({ ...nobody, isAppAdmin: true });

    expect(html).toContain("sidebar.nav.platformAdmin");
    expect(html).toContain("sidebar.nav.userManagement");
    expect(html).toContain("sidebar.nav.failedPlanChanges");
  });

  it("a Billing manager sees Billing", () => {
    expect(render({ ...nobody, canManageBilling: true })).toContain("sidebar.nav.billing");
  });

  it("lists pages only, not Search itself", () => {
    expect(render(nobody)).not.toContain("sidebar.nav.search");
  });
});

describe("isCommandPaletteShortcut", () => {
  const key = (init: Partial<KeyboardEvent>) => ({
    key: "k",
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    ...init,
  });

  it("matches Cmd+K and Ctrl+K", () => {
    expect(isCommandPaletteShortcut(key({ metaKey: true }))).toBe(true);
    expect(isCommandPaletteShortcut(key({ ctrlKey: true }))).toBe(true);
    expect(isCommandPaletteShortcut(key({ ctrlKey: true, key: "K" }))).toBe(true);
  });

  it("ignores a bare K, other keys and extra modifiers", () => {
    expect(isCommandPaletteShortcut(key({}))).toBe(false);
    expect(isCommandPaletteShortcut(key({ ctrlKey: true, key: "j" }))).toBe(false);
    expect(isCommandPaletteShortcut(key({ ctrlKey: true, shiftKey: true }))).toBe(false);
    expect(isCommandPaletteShortcut(key({ ctrlKey: true, altKey: true }))).toBe(false);
  });
});
