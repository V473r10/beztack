import { IconLanguage } from "@tabler/icons-react";
import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  chooseLanguage,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from "@/lib/i18n/create-i18n";

/** Each language is named in itself, so it stays readable from the wrong language. */
const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: "English",
  es: "Español",
};

function isSupportedLanguage(code: string): code is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(code);
}

function LanguageOptions() {
  const { i18n } = useTranslation();
  const current = i18n.resolvedLanguage ?? i18n.language;

  return (
    <DropdownMenuRadioGroup
      value={current}
      onValueChange={(code) => {
        if (isSupportedLanguage(code)) {
          void chooseLanguage(i18n, code);
        }
      }}
    >
      {SUPPORTED_LANGUAGES.map((code) => (
        <DropdownMenuRadioItem key={code} value={code}>
          {LANGUAGE_NAMES[code]}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );
}

type LanguageSelectorProps = {
  /**
   * `button`: a standalone icon button (auth pages, pricing).
   * `submenu`: an entry inside an open dropdown menu (the user menu).
   */
  variant?: "button" | "submenu";
};

/** The one language selector. Picking a language switches the UI and remembers the pick. */
export function LanguageSelector({ variant = "button" }: LanguageSelectorProps) {
  const { t } = useTranslation();

  if (variant === "submenu") {
    return (
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <IconLanguage />
          {t("sidebar.userMenu.language")}
        </DropdownMenuSubTrigger>
        <DropdownMenuPortal>
          <DropdownMenuSubContent>
            <LanguageOptions />
          </DropdownMenuSubContent>
        </DropdownMenuPortal>
      </DropdownMenuSub>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="outline">
          <Languages className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">{t("sidebar.userMenu.language")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <LanguageOptions />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
