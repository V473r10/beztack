import { Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Theme } from "@/contexts/theme-types";
import { useTheme } from "@/hooks/use-theme";

const THEMES: readonly Theme[] = ["light", "dark", "system"];

function isTheme(value: string): value is Theme {
  return (THEMES as readonly string[]).includes(value);
}

/** Light, dark or system mode, for pages that have no settings page around them. */
export function ThemeToggle() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="outline">
          <Sun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
          <span className="sr-only">{t("common.theme.toggle")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          onValueChange={(value) => {
            if (isTheme(value)) {
              setTheme(value);
            }
          }}
          value={theme}
        >
          <DropdownMenuRadioItem value="light">{t("common.theme.light")}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">{t("common.theme.dark")}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">{t("common.theme.system")}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
