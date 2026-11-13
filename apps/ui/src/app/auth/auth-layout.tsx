import { useTranslation } from "react-i18next";
import { Outlet } from "react-router";
import { Toaster } from "sonner";
import { LanguageToggle } from "@/components/language-toggle";
import { env } from "@/env";
import { cn } from "@/lib/utils";
import { DemoTryPanel } from "./demo-try-panel";

type AuthLayoutProps = {
  className?: string;
};

const AuthLayout = ({ className }: AuthLayoutProps) => {
  const { t } = useTranslation();
  const appName = env.VITE_APP_NAME;
  return (
    <div className="flex min-h-screen">
      {/* Brand panel. It holds no heading: each page owns its single h1. */}
      <div className="hidden w-1/2 flex-col justify-between bg-primary p-12 text-primary-foreground lg:flex">
        <div>
          <p className="mb-4 font-bold text-4xl">{appName}</p>
          <p className="text-primary-foreground">{t("auth.brand.tagline")}</p>
        </div>
        <DemoTryPanel variant="brand" />
        <div className="text-primary-foreground text-sm">
          {t("common.footer", { year: new Date().getFullYear(), appName })}
        </div>
      </div>

      {/* Main Content */}
      <div className="relative flex w-full items-center justify-center p-8 lg:w-1/2">
        <div className="absolute top-8 right-8">
          <LanguageToggle />
        </div>
        <div className={cn("w-full max-w-md space-y-8", className)}>
          <div className="mb-8 text-center lg:hidden">
            <p className="font-bold text-3xl">{appName}</p>
          </div>
          <Outlet />
          <div className="lg:hidden">
            <DemoTryPanel variant="compact" />
          </div>
        </div>
      </div>
      <Toaster />
    </div>
  );
};

export default AuthLayout;
