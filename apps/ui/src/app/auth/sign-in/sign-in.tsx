import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { env } from "@/env";
import { SignInForm } from "./components/form";

export default function SignIn() {
  const { t } = useTranslation();
  return (
    <>
      <title>{t("auth.signIn.pageTitle", { appName: env.VITE_APP_NAME })}</title>
      <div className="space-y-1 text-center">
        <h1 className="font-semibold text-2xl tracking-tight">{t("auth.signIn.title")}</h1>
        <p className="text-muted-foreground text-sm">{t("auth.signIn.description")}</p>
      </div>

      <Card className="w-full">
        <CardContent>
          <SignInForm />
        </CardContent>
        <CardFooter className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-muted-foreground text-sm">
            <span className="mr-1 hidden sm:inline-block">{t("auth.signIn.noAccount")}</span>
            <Button asChild className="h-auto p-0 text-primary" variant="link">
              <Link to="/auth/sign-up">{t("auth.signIn.signUp")}</Link>
            </Button>
          </div>
          <Button asChild className="h-auto p-0 text-primary" variant="link">
            <Link to="/auth/reset-password">{t("auth.signIn.forgotPassword")}</Link>
          </Button>
        </CardFooter>
      </Card>
    </>
  );
}
