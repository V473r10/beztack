import { useTranslation } from "react-i18next";
import { Outlet } from "react-router";
import { LanguageToggle } from "@/components/language-toggle";
import { cn } from "@/lib/utils";

type AuthLayoutProps = {
  className?: string;
};

const AuthLayout = ({ className }: AuthLayoutProps) => {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <div className="hidden w-1/2 flex-col justify-between bg-primary p-12 text-primary-foreground lg:flex">
        <div>
          <h1 className="mb-4 font-bold text-4xl">{t("auth.signIn.title")}</h1>
          <p className="text-primary-foreground/80">
            {t("common.workflowStreamline")}
          </p>
        </div>
        <div className="text-primary-foreground/60 text-sm">
          {t("common.footer", { year: new Date().getFullYear() })}
        </div>
      </div>

      {/* Main Content */}
      <div className="relative flex w-full items-center justify-center p-8 lg:w-1/2">
        <div className="absolute top-8 right-8">
          <LanguageToggle />
        </div>
        <div className={cn("w-full max-w-md space-y-8", className)}>
          <div className="mb-8 text-center lg:hidden">
            <h1 className="font-bold text-3xl">{t("common.yourLogo")}</h1>
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
