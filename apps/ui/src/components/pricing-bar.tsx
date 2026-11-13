import { ArrowLeft, LogIn } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { LanguageSelector } from "@/components/language-selector";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { env } from "@/env";

type PricingBarProps = {
  isSignedIn: boolean;
};

/**
 * The pricing page's own top bar. The page sits outside the app shell, so it
 * brings its way back (to the app, or to sign in), the theme and the language.
 */
export function PricingBar({ isSignedIn }: PricingBarProps) {
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-20 border-border/50 border-b bg-background/80 backdrop-blur">
      <nav
        aria-label={t("pricing.bar.label")}
        className="container mx-auto flex items-center justify-between gap-3 px-4 py-3"
      >
        <Link className="min-w-0 truncate font-semibold text-lg" to="/">
          {env.VITE_APP_NAME}
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <Button asChild size="sm" variant="ghost">
            {isSignedIn ? (
              <Link to="/">
                <ArrowLeft />
                {t("pricing.bar.backToApp")}
              </Link>
            ) : (
              <Link to="/auth/sign-in">
                <LogIn />
                {t("pricing.bar.signIn")}
              </Link>
            )}
          </Button>
          <LanguageSelector />
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
